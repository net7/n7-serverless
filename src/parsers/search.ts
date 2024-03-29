import Parser, { Input, SearchOptions } from "../interfaces/parser";
import { SearchResultsData, SearchResultsItemData } from "../interfaces/parser-data/search";

export abstract class SearchParser implements Parser {
  parse({ data, options }: Input, queryParams = null) {
    const { type } = options as SearchOptions;
    return type === 'results'
      ? this.parseResults({ data, options }, queryParams)
      : this.parseFacets({ data, options });
  }

  protected abstract parseResultsItems({ data, options }: Input, queryParams?): SearchResultsItemData[];

  protected searchResultsMetadata(source, field, label){
    const item = [];
    field.map((f) => {
      item[label][0].items.push({
        label: source[f] ? f : null,
        // value: f === 'contenuti' ? (source[f] || []).map(sf => sf['contenuto']) : source[f]
        value: source[f],
      });
    });
    return item;
  }

  protected parseResults({ data, options }: Input, queryParams = null) {
    if (options && "limit" in options) {
      var { offset, limit, sort, total_count } = options;
    }
    const search_result: SearchResultsData = {
      limit,
      offset,
      sort,
      total_count,
      results: []
    };
    search_result.results = this.parseResultsItems({ data, options }, queryParams);
    // implementare 
    // data.forEach(({ _source: source }) => {
    //   const item = {} as SearchResultsItemData;
    //   conf.results.forEach((val: { label: string; field: any }) => {
    //     switch (val.label) {
    //       case 'title':
    //       case 'text':
    //         item[val.label] = source[val.field] || null;
    //         break;
    //       case 'metadata':
    //         item[val.label] = [
    //           {
    //             items: [],
    //           },
    //         ];

    //         val.field.map((f) => {
    //           item[val.label][0].items.push({
    //             label: source[f] ? f : null,
    //             // value: f === 'contenuti' ? (source[f] || []).map(sf => sf['contenuto']) : source[f]
    //             value:
    //               f === 'origine' && source[f]
    //                 ? source[f].replace(/(<([^>]+)>)/gi, '')
    //                 : source[f],
    //           });
    //         });
    //         break;
    //       case 'image':
    //         item[val.label] = source[val.field] || null;
    //         break;
    //       case 'link':
    //         item[
    //           val.label
    //         ] = `/${source['record-type']}/${source.id}/${source.slug}`;
    //         break;
    //       case 'id':
    //         item[val.label] = source.id;
    //         break;
    //       case 'routeId':
    //           item[val.label] = source[val.field];
    //       case 'slug':
    //         item[val.label] = source[val.field];
    //       default:
    //         break;
    //     }
    //   });
    //   items.push(item);
    // });

    return search_result;

  }

  protected parseFacets({ data, options }: Input) {
    let global_sum = 0;
    const { facets, conf, searchId } = options as SearchOptions;
    const agg_res: any = {
      total_count: 0,
      facets: {}
    }
    const query_facets = conf[searchId]['facets-aggs'].aggregations

    facets.forEach(({ id, query, offset }) => {
      let sum = 0;
      let filteredTotal = 0;
      let values: any[] = [];
      if (data[id]) {
        let buckets_data =  getBucket(data[id]);
        if (buckets_data && buckets_data.buckets) {
          if(offset && offset > 0){
            sum += offset;
            buckets_data.buckets = buckets_data.buckets.slice(offset)
          }
          if(buckets_data['distict_doc_count']){
            filteredTotal = buckets_data['distict_doc_count'];
          } else if( data["distinctTerms_" + id] ){
            filteredTotal = data["distinctTerms_" + id]["value"];
          }
          buckets_data.buckets.forEach((agg: { key: string; doc_count: number, from?: any, to?: any }, index:number) => {

            const haystack_formatted = (agg.key.split("|||")[0] || '').toLowerCase();
            const haystack_notFormatted = (agg.key.split("|||")[1] || '').toLowerCase();
            const needle = (query || '').toLowerCase();
            if (haystack_formatted.includes(needle) || haystack_notFormatted.includes(needle)) {
              const facet = {
                text: agg.key.split("|||")[1],
                counter: agg.doc_count,
                payload: agg.key.split("|||")[0]
            };
            if(query_facets[id]['extra']){
                const extra_args = {};
                for (const key in query_facets[id]['extra']) {
                    if(agg[key] && agg[key]['buckets']){
                      if(agg[key]['buckets'].length == 1){
                        extra_args[key] = agg[key]['buckets'][0]?.key
                    } else if(agg[key]['buckets'].length > 1)  {
                        extra_args[key] = agg[key]['buckets'].map((bucket) => { return bucket['key']; });
                    }   
                    else {
                        extra_args[key] = null;
                    }  
                }
              }
              facet['args'] = extra_args;
            }
            if(query_facets[id]['ranges']){
              if(agg.from){
                facet['text'] = query_facets[id]['ranges'][index]["from"];
                facet['payload'] = agg.from;
              }
              if(agg.to){
                facet['range'] = {
                  text: query_facets[id]['ranges'][index]["to"],
                  payload: agg.to
                }
              }

            }
            values.push(facet);
             // filteredTotal += 1;
          }
            sum++;
          });

          if( query_facets[id]['sortValues'] ){
                values.sort( (a, b) => { 
                    return query_facets[id]['sortValues'].indexOf(a['payload']) - query_facets[id]['sortValues'].indexOf(b['payload']);
                } 
              )
          }
        }
      }
      global_sum += sum;
      agg_res.facets[id] = {
        total_count: filteredTotal,
        filtered_total_count: filteredTotal, 
        values,
      };
      agg_res.total_count = global_sum;
    });

    // pagination chunk
   /* facets
      .forEach(facet => {
        agg_res.facets[facet.id].values = agg_res.facets[facet.id].values.slice(facet.offset, facet.offset + facet.limit)
      });*/
    return agg_res;
  }

}

function getBucket(data, doc_count = null, distict_doc_count = null) {
  let keys = Object.keys(data);
  var bucketData;
  if (keys.includes("buckets")) {
    if( data['doc_count'] === undefined ){
      data['doc_count'] = doc_count;
      if (distict_doc_count) {
        data['distict_doc_count'] = distict_doc_count;
      }
    }
    return data;
  }
  else {
      keys.forEach(k => { 
        if (k != "distinctTerms" && typeof data[k] === "object"){
          const c =  data[k]['doc_count'] || data["doc_count"];
          const dt = data["distinctTerms"] ? data["distinctTerms"]["value"] : null;
          bucketData = getBucket(data[k], c, dt);
        }
      });
  }
  if (bucketData && bucketData.buckets) {
      if( bucketData['doc_count'] === undefined ){
          bucketData['doc_count'] = doc_count;
      }
      if(distict_doc_count ){
        data['distict_doc_count'] = distict_doc_count;
      }
      return bucketData;
  }
}