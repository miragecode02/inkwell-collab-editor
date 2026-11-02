import { describe, it, expect } from 'vitest';
import { RgaDocument, RgaOp } from './rga';

describe('RGA basic local editing', () => {
  it('inserts and deletes locally like a normal text buffer', () => {
    const doc = new RgaDocument('site-A');
    doc.localInsert(0, 'hello');
    expect(doc.getText()).toBe('hello');
    doc.localInsert(5, ' world');
    expect(doc.getText()).toBe('hello world');
    doc.localDelete(5); // delete the space
    expect(doc.getText()).toBe('helloworld');
  });
});

describe('RGA convergence under concurrency (the actual point of this project)', () => {
  it('THE motivating case: concurrent insert + delete near the same position', () => {
    // Both replicas start with "hello" already synced.
    const a = new RgaDocument('A');
    const b = new RgaDocument('B');
    const seed = a.localInsert(0, 'hello');
    for (const op of seed) b.applyInsert(op);
    expect(a.getText()).toBe('hello');
    expect(b.getText()).toBe('hello');

    // Concurrently: A inserts "!!!" at the end (pos 5).
    // B deletes the 'e' (pos 1), *without having seen A's op yet*.
    const aOps = a.localInsert(5, '!!!'); // A -> "hello!!!"
    const bOp = b.localDelete(1); // B -> "hllo"

    // Now deliver each side's ops to the other, in a DIFFERENT order
    // than they were generated, and with no coordination — this is
    // exactly what happens over a real network with jitter.
    for (const op of aOps) b.applyInsert(op);
    if (bOp) a.applyDelete(bOp);

    // A naive index-based approach breaks here: if you took "delete
    // character at index 1" literally on A's side after A had already
    // inserted at index 5, you'd delete the wrong character, because
    // A's indices shifted. RGA never does index-based deletes across
    // replicas — deletes always reference a stable id — so this can't
    // happen.
    expect(a.getText()).toBe(b.getText());
    expect(a.getText()).toBe('hllo!!!');
  });

  it('converges regardless of the order ops are delivered in', () => {
    const a = new RgaDocument('A');
    const b = new RgaDocument('B');
    const c = new RgaDocument('C');

    const seed = a.localInsert(0, 'race');
    for (const op of seed) {
      b.applyInsert(op);
      c.applyInsert(op);
    }

    // Three concurrent edits from three different sites, none of which
    // have seen each other's operation yet.
    const opsA = a.localInsert(4, 'A'); // "raceA"
    const opsB = b.localInsert(0, 'B'); // "Brace"
    const opsC = c.localDelete(2); // delete 'c' -> "rae"

    const allOps: RgaOp[] = [...opsA, ...opsB, ...(opsC ? [opsC] : [])];

    // Deliver to A in one order, to B in a shuffled order, to C in
    // reverse order. A real network gives no delivery-order guarantee
    // across peers, so this is the actual property we need.
    const forA = allOps.filter((op) => !opsA.includes(op as any));
    const forB = [...allOps].reverse().filter((op) => !opsB.includes(op as any));
    const forC = [allOps[2], allOps[0], allOps[1]].filter((op) => op && !(opsC && op === opsC));

    for (const op of forA) op.type === 'insert' ? a.applyInsert(op) : a.applyDelete(op);
    for (const op of forB) op.type === 'insert' ? b.applyInsert(op) : b.applyDelete(op);
    for (const op of forC) op.type === 'insert' ? c.applyInsert(op) : c.applyDelete(op);

    expect(a.getText()).toBe(b.getText());
    expect(b.getText()).toBe(c.getText());
  });

  it('is idempotent: re-applying the same op (duplicate delivery) is a no-op', () => {
    const a = new RgaDocument('A');
    const b = new RgaDocument('B');
    const ops = a.localInsert(0, 'idempotent');
    for (const op of ops) {
      b.applyInsert(op);
      b.applyInsert(op); // duplicate delivery, e.g. a WebSocket retry
      b.applyInsert(op);
    }
    expect(b.getText()).toBe('idempotent');
    expect(b.length()).toBe('idempotent'.length);
  });

  it('preserves both users\' concurrent inserts at the exact same position', () => {
    // This is the classic "two people type at the exact same spot" case.
    const a = new RgaDocument('A');
    const b = new RgaDocument('B');
    const seed = a.localInsert(0, 'ac');
    for (const op of seed) b.applyInsert(op);

    // Both insert between 'a' and 'c' concurrently, neither has seen the other's op.
    const opsA = a.localInsert(1, 'B'); // A's local view: "aBc"
    const opsB = b.localInsert(1, 'X'); // B's local view: "aXc"

    for (const op of opsB) a.applyInsert(op);
    for (const op of opsA) b.applyInsert(op);

    // Neither user's keystroke is lost, and both replicas agree on
    // exactly the same final ordering of the two concurrent inserts.
    expect(a.getText()).toBe(b.getText());
    expect(a.getText().length).toBe(4);
    expect(new Set(a.getText())).toEqual(new Set('aBXc'));
  });

  it('converges on concurrent multi-character inserts at the same position', () => {
    // This is the critical case for a text editor: Alice types "Hello" and Bob
    // types "World", both starting from an empty document, with zero network
    // delivery between them (fully concurrent). Each character after the first
    // is chained off the previous one (originId = previous char's id), so
    // Alice's H→e→l→l→o and Bob's W→o→r→l→d are two independent chains both
    // rooted at null. Without the "skip-descendant-chains" fix in applyInsert,
    // the scan stops at the first different-origin node and inserts between H
    // and e, producing "HWorldello" vs "HelloWorld" — non-convergent.
    const alice = new RgaDocument('alice');
    const bob = new RgaDocument('bob');

    const aliceOps = alice.localInsert(0, 'Hello');
    const bobOps = bob.localInsert(0, 'World');

    // Cross-apply in both orders — this is the hard case
    for (const op of bobOps) alice.apply(op);
    for (const op of aliceOps) bob.apply(op);

    expect(alice.getText()).toBe(bob.getText());
    expect(alice.getText()).toContain('Hello');
    expect(alice.getText()).toContain('World');
    expect(alice.getText().length).toBe(10);
  });

  it('orders a later head-insert before an earlier one sharing the null origin', () => {
    // Both "Hello world" and a subsequently-typed "- " prefix anchor to
    // originId=null (the document head), since they're both the first
    // character at their respective insertion point. The RGA ordering
    // rule says siblings sharing an origin sort by id DESCENDING (higher
    // counter first) — so the later "- " insert, despite sharing an
    // origin with the much older 'H', must still land in front of it.
    const doc = new RgaDocument('site-A');
    doc.localInsert(0, 'Hello world');
    doc.localInsert(0, '- ');
    expect(doc.getText()).toBe('- Hello world');
  });

  it('converges when two replicas concurrently insert at the head of a shared, non-empty doc', () => {
    const a = new RgaDocument('A');
    const b = new RgaDocument('B');
    const seed = a.localInsert(0, 'shared text');
    for (const op of seed) b.applyInsert(op);

    const opsA = a.localInsert(0, 'A-prefix ');
    const opsB = b.localInsert(0, 'B-prefix ');
    for (const op of opsB) a.applyInsert(op);
    for (const op of opsA) b.applyInsert(op);

    expect(a.getText()).toBe(b.getText());
    expect(a.getText()).toContain('shared text');
  });

  it('handles a 5-way random-order stress case deterministically', () => {
    const sites = ['A', 'B', 'C', 'D', 'E'].map((s) => new RgaDocument(s));
    const allOps: RgaOp[] = [];

    // Each site independently inserts its own name into an initially empty doc.
    sites.forEach((doc, i) => {
      const ops = doc.localInsert(0, ['A', 'B', 'C', 'D', 'E'][i]);
      allOps.push(...ops);
    });

    // Shuffle deterministically and deliver everything to every site.
    function shuffle<T>(arr: T[], seed: number): T[] {
      const out = [...arr];
      for (let i = out.length - 1; i > 0; i--) {
        seed = (seed * 9301 + 49297) % 233280;
        const j = Math.floor((seed / 233280) * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    }

    sites.forEach((doc, i) => {
      const incoming = allOps.filter((_, idx) => idx % 5 !== i); // skip its own op (already applied locally)
      for (const op of shuffle(incoming, i + 1)) {
        op.type === 'insert' ? doc.applyInsert(op) : doc.applyDelete(op);
      }
    });

    const results = sites.map((d) => d.getText());
    expect(new Set(results).size).toBe(1); // all five replicas agree
  });
});
