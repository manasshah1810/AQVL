/**
 * The three kinds of challenge on /challenges. Each is a section with its own
 * route segment; Complete the Algorithm and Ghost Move are built; Fork the Future
 * has its place ready (their designs are in docs/challenges/).
 */
export interface ChallengeSection {
  id: 'complete' | 'ghost' | 'fork';
  number: string;
  title: string;
  blurb: string;
  status: 'live' | 'soon';
}

export const SECTIONS: ChallengeSection[] = [
  {
    id: 'complete',
    number: '01',
    title: 'Complete the Algorithm',
    blurb: 'An algorithm is missing a piece. Fill it in, press Run, and watch your version play out in 3D. If it is wrong, you see it go wrong.',
    status: 'live',
  },
  {
    id: 'ghost',
    number: '02',
    title: 'Ghost Move',
    blurb: 'The run pauses before a step. Drag a ghost of the moving piece to where you think it lands, then watch the real step.',
    status: 'live',
  },
  {
    id: 'fork',
    number: '03',
    title: 'Fork the Future',
    blurb: 'At a decision point the stage splits into short previews of what might happen next. Pick the one that is real.',
    status: 'soon',
  },
];
