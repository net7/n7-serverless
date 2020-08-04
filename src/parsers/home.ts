import Parser from "../interfaces/parser";
import { HeroData, CollectionData } from "../interfaces/parser-data/home";

class Hero implements HeroData {
  title: null;
  text: null;
  image: null;
  button: {
    title: null;
    text: null;
    link: null;
  }
}

class Collection implements CollectionData {
  header: {
    title: null;
    subtitle: null;
  };
  items: []
}

export default class HeaderParser implements Parser {
  parse(input) {
    const { order, data, config } = input;
    let parsedData = {};
    let orderedParsedData = {};
    for (const key in config) {
      const f = config[key].field
      if (/hero-.+/.test(key)) {
        const hero: HeroData = new Hero();
        hero.title = data[f].title || null
        hero.text = data[f].text || null
        hero.image = data[f].image || null
        hero.button = data[f].button.anchor === ''
          ? null
          : {
            title: data[f].button.title,
            text: data[f].button.text || null,
            link: data[f].button.anchor
          }
        parsedData[key] = { ...hero }
      }
      if (/collection-.+/.test(key)) {
        let collection: CollectionData = new Collection();
        //header
        collection.header.title = data[f].title || null
        collection.header.subtitle = data[f].subtitle || null
        collection.header.button =
          data[f].button.anchor === ''
            ? null
            : {
              title: data[f].button.title,
              text: data[f].button.text || null,
              link: data[f].button.anchor
            }
        // items
        if (/collection-works/.test(key)) { // FIXME: Remove project-scoped code
          data[f].items.map(item => {
            collection.items.push(
              {
                title: item.item[0].title || null,
                text: item.item[0].description || null,
                link: `/${item.item[0].type}/${item.item[0].id}/${item.item[0].slug}` || null
              }
            )
          })
        } else { // FIXME: Remove project-scoped code
          data[f].items.map(item => {
            collection.items.push(
              {
                title: Object.keys(item.item).map(m => item.item[m].name).join() || null,
                text: item.text || null,
                image: item.image || null,
                link: `/maps?continents=${Object.keys(item.item).map(m => item.item[m].key).join() || null}`
              }
            )
          })
        }
        parsedData[key] = { ...collection }
      }
    }
    order.map(ord => {
      orderedParsedData[ord] = parsedData[ord];
    })
    return orderedParsedData;
  }
}