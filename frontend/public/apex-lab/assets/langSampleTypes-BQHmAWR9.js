var e=`// Shared types for the multi-language code examples (see langSamples.ts). Split out so the data can live in more than\r
// one file without either importing the other.\r
\r
export type Lang = 'python' | 'go' | 'rust' | 'c' | 'cpp';\r
export const LANGS: { id: Lang; label: string }[] = [\r
  { id: 'python', label: 'Python' }, { id: 'go', label: 'Go' }, { id: 'rust', label: 'Rust' },\r
  { id: 'c', label: 'C' }, { id: 'cpp', label: 'C++' },\r
];\r
\r
export interface Snippet { lang: Lang; code: string }\r
export interface ExampleSet {\r
  intro: string;      // what the snippets compute\r
  expect: string;     // the stdout every snippet must print (the verification anchor)\r
  snippets: Snippet[];\r
}\r
`;export{e as default};