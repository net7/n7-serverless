// import Parser, { Input } from "../interfaces/parser";
// export class StaticPostParser implements Parser {
//   parse({ data, options }: Input) {
//     if (options && 'slug' in options) {
//       if (Array.isArray(data)) {
//         return data
//           .filter(d => d.slug === options.slug)
//           .map((d: any) => ({
//             title: d.title.rendered,
//             date: d.date,
//             content: d.content.rendered,
//             authors: d.author,
//             time_to_read: d.time_to_read,
//             slug: d.slug
//           }))[0];
//       }
//     }
//     return {};
//   }
// }
