import { Client } from '@elastic/elasticsearch';
import * as sortObj from 'sort-object';
import { HttpHelper, ESHelper } from './helpers';
import { SearchResultsData } from './interfaces';
import { AdvancedSearchParser } from './parsers';

export class Controller {
  private config: any;

  constructor(config: any) {
    this.config = config;
  }

  getNavigation = async (_event: any, _context: any, _callback: any) => {
    const { baseUrl, parsers } = this.config;
    const data = JSON.parse(await HttpHelper.doRequest(baseUrl + "menu"));
    const parser = new parsers.menu();
    const response = parser.parse(data);
    return HttpHelper.returnOkResponse(response);
  }

  getHomeLayout = async (event: any, _context: any, _callback: any) => {
    const { baseUrl, parsers, configurations } = this.config;
    const keyOrder = JSON.parse(event.body);
    const data = JSON.parse(await HttpHelper.doRequest(baseUrl + "layout/home"));
    const parser = new parsers.home();
    const response = parser.parse({
      data,
      options: {
        keyOrder,
        conf: configurations.home
      }
    });
    return HttpHelper.returnOkResponse(response);
  }

  getSearchDescription = async (event: any, _context: any, _callback: any) => {
    const { baseUrl, parsers } = this.config;
    const { searchId } = event.pathParameters;
    const data = JSON.parse(await HttpHelper.doRequest(baseUrl + "layout/" + searchId));
    const parser = new parsers.searchDescription();
    const response = parser.parse({ data });
    return HttpHelper.returnOkResponse(response);
  }

  getTimeline = async (event: any, _context: any, _callback: any) => {
    const { baseUrl, parsers } = this.config;
    const { id } = event.pathParameters;
    const data = JSON.parse(await HttpHelper.doRequest(baseUrl + "views/" + id));
    const parser = new parsers.timeline();
    const response = parser.parse({ data });
    return HttpHelper.returnOkResponse(response);
  }

  getResource = async (event: any, _context: any, _callback: any) => {
    const { baseUrl, parsers, configurations } = this.config;
    // change id whit slug and no un parameters but in the boy request  in POST
    let { type, id, sections } = JSON.parse(event.body);
    const requestURL = baseUrl;
    const url = requestURL + type + "/" + id;
    //remove, only for test
    const data = JSON.parse(await HttpHelper.doRequest(url));
    const parser = new parsers.resource();
    const response = parser.parse({
      data,
      options: {
        type,
        conf: configurations.resources[type]
      },
    });
    const sect = sortObj(response.sections, sections); // body sections filters
    response.sections = sect;
    return HttpHelper.returnOkResponse(response);
  }

  search = async (event: any, _context: any, _callback: any) => {
    const { parsers, searchIndex, elasticUri, configurations } = this.config;
    const body = JSON.parse(event.body) // cf. SEARCH-RESULTS in Postman
    const { type } = event.pathParameters;
    const params = ESHelper.buildQuery(body, configurations.search); // return main_query (cf. Basic Query Theatheor body JSON su Postman)
    // make query
    const query_res: any = await ESHelper.makeSearch(searchIndex, params, Client, elasticUri);
    const data = type === 'results' ? query_res.hits.hits : query_res.aggregations;
    const parser = new parsers.search();
    const { searchId, facets } = body;
    const { limit, offset, sort } = body.results ? body.results : "null";
    let total_count = query_res.hits.total.value; 
    const response = parser.parse({
      data,
      options: {
        type,
        offset,
        sort,
        limit,
        total_count,
        searchId,
        facets,
        conf: configurations.search
      }
    });
    
    return HttpHelper.returnOkResponse(response);
  }

  advancedSearch = async (event: any, _context: any, _callback: any) => {
    const { parsers, searchIndex, elasticUri, teiPublisherUri, configurations } = this.config;
    const body = JSON.parse(event.body) // cf. SEARCH-RESULTS in Postman
    const parser = new AdvancedSearchParser();
    const params = parser.buildAdvancedQuery(body, configurations); // return main_query (cf. Basic Query Theatheor body JSON su Postman)
    const query_res: any = await ESHelper.makeSearch(searchIndex, params, Client, elasticUri);
    const es_data = query_res.hits.hits;
    let map_data = {};
        es_data.map((res) => {
          if (res['_source']['xml_filename']) {
            const xml_filename = res['_source']['xml_filename'];
            map_data[xml_filename] = res;
          }
        });
    const docs = Object.keys(map_data);
    const teiPublisherParams = parser.buildTextViewerQuery(body, configurations, docs);
    let total_count = query_res.hits.total.value;
    var data = [];
    
    if( teiPublisherParams ){
      const collectionUri =
            'http://staging.teipublisher.netseven.it/exist/apps/tei-publisher/api/mrcsearch';
          const doc = await HttpHelper.doRequest(
            collectionUri + '?' + teiPublisherParams
          );
          let stripped_doc = doc.replace(/<!DOCTYPE\s\w+>/g, '');
          let wrapped_doc = '<body>' + stripped_doc + '</body>';

          let convert = require('xml-js');
          let expandedResult = convert.xml2js(wrapped_doc, {
            // ignoreDoctype: true,
            // ignoreDeclaration: true,
            compact: true,
            spaces: 4,
          });

          let matches_result = {};
          if(expandedResult['body']['paper-card']){          
            expandedResult['body']['paper-card'].map((papercard) => {
              let div = papercard.div.div;
              let id = papercard['_attributes'].id;
              let href = div.a ? div.a['_attributes']['href'] : "";
              let a = Array.isArray(div) ? div === null || div === void 0 ? void 0 : div.map((element) => {
                      href = element.a['_attributes']['href']; return element.a['_text']; 
                  }) : div.a['_text'];
              let em = Array.isArray(div) ? div === null || div === void 0 ? void 0 : div.map((element) => element.a.em['_text']) : div.a.em['_text'];
              if (!matches_result[id]) {
                  matches_result[id] = {
                      matches: [],
                  };
              }
              for (let i = 0; i < a.length; i++) {
                  //evita duplicati
                  if(!Array.isArray(a[i]) && i > 0) return;
                  const pre_text = Array.isArray(a[i]) ? a[i][0] : a[0];
                  const post_text = Array.isArray(a[i]) ? a[i][1] : a[1];
                  const em_text = Array.isArray( em ) ? em[i]  :  em;
                  const text_highlight = pre_text + "<em class='mrc__text-emph'>" + em_text + "</em>" + post_text
                  matches_result[id].matches.push(
                    {
                      link: "?root=" + href.replace("#", ""),
                      text: text_highlight
                    }
                  );
              }
            });
          }

          es_data.map((res) => {
            if (res['_source']['xml_filename']) {
              for (let key in matches_result) {
                if (key === res['_source']['xml_filename']) {
                  if ( !res['highlight'] ){
                    res['highlight'] = {};
                  }
                  res['highlight']['text_matches'] =  matches_result[key].matches;                
                  data.push(res);
                }
              }
            }
          });

          total_count = data.length;
    } else {
      data = es_data;
    }
    const { searchId } = body;
    const { limit, offset, sort } = body.results ? body.results : "null";
    const response = parser.advancedParseResults({
      data,
      options: {
        offset,
        sort,
        limit,
        total_count,
        searchId,
        conf: configurations.advanced_search
      }
    });
    
    return HttpHelper.returnOkResponse(response);
  }

  getFooter = async (_event: any, _context: any, _callback: any) => {
    const { baseUrl, parsers, configurations } = this.config;
    const data = JSON.parse(await HttpHelper.doRequest(baseUrl + "footer"));
    const parser = new parsers.footer();
    const response = parser.parse(data, { conf: configurations.footer });
    return HttpHelper.returnOkResponse(response);
  }

  getTranslation = async (event: any, _context: any, _callback: any) => {
    const { baseUrl, parsers } = this.config;
    const { lang } = event.pathParameters;
    const data = JSON.parse(await HttpHelper.doRequest(baseUrl + "translations?lang=" + lang));
    const parser = new parsers.translation();
    const response = parser.parse({
      data,
      options: {
        lang
      },
    });
    return HttpHelper.returnOkResponse(response);
  }

  getStaticPage = async (event: any, _context: any, _callback: any) => {
    const { parsers, staticUrl } = this.config;
    const { slug } = event.pathParameters;
    const data = JSON.parse(await HttpHelper.doRequest(staticUrl + 'pages?'+ "slug=" + slug));
    const parser = new parsers.static();
    const response = parser.parse({ data });
    if ( response ){
      return HttpHelper.returnOkResponse(response);
    } else {
      return HttpHelper.returnErrorResponse("page not found", 404);
    }
  }

  getStaticPost = async (event: any, _context: any, _callback: any) => {
    const { parsers, staticUrl } = this.config;
    const { slug } = event.pathParameters;
    const data = JSON.parse(await HttpHelper.doRequest(staticUrl + 'posts?'+ "slug=" + slug));
    const parser = new parsers.static();
    const response = parser.parse({ data });
    if ( response ){
      return HttpHelper.returnOkResponse(response);
    } else {
      return HttpHelper.returnErrorResponse("page not found", 404);
    }
  }

  getTypeList = async (event: any, _context: any, _callback: any) => {
    const { parsers, staticUrl } = this.config;
    const { type } = event.pathParameters;
    const body = JSON.parse(event.body)

    let params = "";
    
    if( body.results && body.results.limit  ){
      params = "per_page=" + body.results.limit;
    }

    if( body.results && body.results.offset  ){
      params += params == "" ? "offset=" + body.results.offset : "&offset=" + body.results.offset;
    }

    const apiUrl = params != "" ? staticUrl + type + "?" + params : staticUrl + type;
    const data = JSON.parse(await HttpHelper.doRequest(apiUrl));
    const parser = new parsers.static();
   
    const response : SearchResultsData =  { 
      results: parser.parseList({ data, options: { type } }),
      limit: body.results.limit || 10,
      offset: body.results.offset || 0,
      total_count: data.length,
      sort: ""
    };
    return HttpHelper.returnOkResponse(response);
  }

  getItineraries = async (event: any, _context: any, _callback: any) => {
    const { parsers, baseUrl, configurations } = this.config;
    const data = JSON.parse(await HttpHelper.doRequest(baseUrl + 'itinerary'));
   /* const parser = new parsers.itineraries();
    const response = parser.parse({ data });
    if ( response ){
      return HttpHelper.returnOkResponse(response);
    } else {
      return HttpHelper.returnErrorResponse("page not found", 404);
    }*/
  }

  getItinerary = async (event: any, _context: any, _callback: any) => {
    const { parsers, baseUrl, configurations } = this.config;
    const { id } = event.pathParameters;
    const data = JSON.parse(await HttpHelper.doRequest(baseUrl + 'itinerary/'+ id));
    const parser = new parsers.itinerary(configurations?.itineraries);
    const response = parser.parse({ data });
    if ( response ){
      return HttpHelper.returnOkResponse(response);
    } else {
      return HttpHelper.returnErrorResponse("page not found", 404);
    }
  }

  getSlsMethods() {
    return {
      getNavigation: this.getNavigation.bind(this),
      getFooter: this.getFooter.bind(this),
      getHomeLayout: this.getHomeLayout.bind(this),
      getSearchDescription: this.getSearchDescription.bind(this),
      getTimeline: this.getTimeline.bind(this),
      getResource: this.getResource.bind(this),
      search: this.search.bind(this),
      advancedSearch: this.advancedSearch.bind(this),
      getTranslation: this.getTranslation.bind(this),
      getStaticPage: this.getStaticPage.bind(this),
      getStaticPost: this.getStaticPost.bind(this),
      getTypeList: this.getTypeList.bind(this),
      getItinerary: this.getItinerary.bind(this),
      getItineraries: this.getItineraries.bind(this)
    }
  }  
}
