/**
 * Facts shown while something loads. Only well-documented history and
 * results; each line names who and when so it can be checked.
 */
export const FACTS: string[] = [
  'The word “algorithm” comes from al-Khwarizmi, a ninth-century Persian mathematician who worked at the House of Wisdom in Baghdad.',
  'Euclid’s method for the greatest common divisor appears in the Elements, around 300 BC, and is still in everyday use.',
  'Ada Lovelace’s 1843 notes on Babbage’s Analytical Engine include a procedure for computing Bernoulli numbers, often called the first published program.',
  'Alan Turing’s 1936 paper “On Computable Numbers” showed that some well-defined problems cannot be solved by any algorithm at all.',
  'John von Neumann described merge sort in 1945.',
  'Konrad Zuse described breadth-first search in 1945; Edward F. Moore rediscovered it in 1959 to find the shortest way out of a maze.',
  'Binary search was first mentioned by John Mauchly in 1946, but a version correct for every array size was not published until 1960.',
  'In Programming Pearls, Jon Bentley reports that only about one in ten professional programmers he asked wrote a correct binary search.',
  'Java’s library binary search computed (low + high) / 2, which overflows on huge arrays. The bug went unnoticed for about nine years, until Joshua Bloch reported it in 2006.',
  'In 1947 the Harvard Mark II team taped a moth found in a relay into their logbook: “first actual case of bug being found.”',
  'Hans Peter Luhn proposed hashing with chained buckets in an IBM memo in 1953.',
  'Linked lists were developed in 1955–56 by Allen Newell, Cliff Shaw and Herbert Simon for their Information Processing Language.',
  'Edsger Dijkstra designed his shortest-path algorithm in 1956 in about twenty minutes, at a café in Amsterdam, without pencil and paper.',
  'Joseph Kruskal published his minimum spanning tree algorithm in 1956. Robert Prim’s followed in 1957, but Vojtěch Jarník had found the same method in 1930.',
  'Friedrich Bauer and Klaus Samelson patented the stack principle, which they called the “Kellerprinzip,” in 1957.',
  'Donald Shell published Shellsort in 1959.',
  'Tony Hoare invented quicksort in 1959 while a visiting student at Moscow State University, working on machine translation.',
  'René de la Briandais described the trie in 1959; Edward Fredkin named it in 1960, from the middle of “retrieval.”',
  'The AVL tree, published by Georgy Adelson-Velsky and Evgenii Landis in 1962, was the first self-balancing binary search tree.',
  'J. W. J. Williams introduced heapsort and the binary heap together in 1964.',
  'Donald Knuth started The Art of Computer Programming in 1962; volume one appeared in 1968.',
  'Knuth sends a cheque for $2.56, “one hexadecimal dollar,” to the first finder of each error in his books.',
  'The A* search algorithm was published in 1968 by Peter Hart, Nils Nilsson and Bertram Raphael, for the Shakey robot at SRI.',
  'Dijkstra’s letter “Go To Statement Considered Harmful” appeared in Communications of the ACM in 1968. The title was chosen by the editor, Niklaus Wirth.',
  'Red–black trees grew out of Rudolf Bayer’s 1972 symmetric binary B-trees; Leonidas Guibas and Robert Sedgewick gave them their colours in 1978.',
  'Édouard Lucas published the Tower of Hanoi puzzle in 1883. Moving n disks takes exactly 2ⁿ − 1 moves.',
  'No comparison sort can beat roughly n log₂ n comparisons in the worst case: there are n! possible orders to tell apart.',
  'The Bellman–Ford algorithm handles negative edge weights, which Dijkstra’s algorithm cannot.',
];

let deck: number[] = [];
let last = -1;

/** Next fact index: walks a shuffled deck, never repeats the previous one. */
export function nextFactIndex(): number {
  if (deck.length === 0) {
    deck = FACTS.map((_, i) => i);
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    if (deck[deck.length - 1] === last) {
      [deck[0], deck[deck.length - 1]] = [deck[deck.length - 1], deck[0]];
    }
  }
  last = deck.pop() as number;
  return last;
}
