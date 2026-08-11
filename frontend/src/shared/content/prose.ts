/**
 * Typography for rendered post content.
 *
 * Shared by the reader and the studio's editing surface so a writer sees what a
 * reader will see. Written as Tailwind arbitrary-variant selectors rather than
 * a plugin because the tag set is small, fixed by the sanitiser's allowlist,
 * and not worth a dependency.
 */
export const PROSE_CLASS = [
  'space-y-4 leading-7',
  '[&_a]:underline [&_a]:underline-offset-4',
  '[&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-semibold',
  '[&_h3]:mt-6 [&_h3]:text-lg [&_h3]:font-semibold',
  '[&_ul]:list-disc [&_ol]:list-decimal [&_li]:ml-5',
  '[&_blockquote]:border-l-2 [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground',
  '[&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-4',
  '[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[0.9em]',
  '[&_pre_code]:bg-transparent [&_pre_code]:p-0',
  '[&_img]:rounded-lg',
  '[&_hr]:my-8',
].join(' ')
