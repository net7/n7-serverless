import { Client } from '@elastic/elasticsearch';
import * as sortObj from 'sort-object';
import * as controllers from './controllers';
import { HttpHelper, ESHelper } from './helpers';
import { SearchResultsData } from './interfaces';
import { ResourceParser } from './parsers';

export class Controller {
    private config: any;

    constructor(config: any) {
        this.config = config;
    }

    postTest = async (event: any, _context: any, _callback: any) => {
        const body = JSON.parse(event.body) //la richiesta che arriva all'API
        const response: any = body;
        return HttpHelper.returnOkResponse(response);
    }

    getTest = async (event: any, _context: any, _callback: any) => {
        const response: any = 'dummy string';
        return HttpHelper.returnOkResponse(response);
    }

    getNavigation = async (_event: any, _context: any, _callback: any) => {
        const { baseUrl, parsers } = this.config;
        const { locale } = _event.queryStringParameters ? _event.queryStringParameters : '';
        const path = locale ? 'menu?lang=' + locale : 'menu';
        const data = JSON.parse(await HttpHelper.doRequest(baseUrl + path));
        const parser = new parsers.menu();
        const response = parser.parse(data);
        return HttpHelper.returnOkResponse(response);
    };

    getHomeLayout = async (event: any, _context: any, _callback: any) => {
        const { baseUrl, parsers, configurations } = this.config;
        const keyOrder = JSON.parse(event.body);
        const { locale } = event.queryStringParameters ? event.queryStringParameters : '';
        const path = locale ? 'layout/home?lang=' + locale : 'layout/home';
        const data = JSON.parse(
            await HttpHelper.doRequest(baseUrl + path)
        );
        const parser = new parsers.home();
        const response = parser.parse({
            data,
            options: {
                keyOrder,
                conf: configurations.home,
            },
        });
        return HttpHelper.returnOkResponse(response);
    };

    getSearchDescription = async (event: any, _context: any, _callback: any) => {
        const { baseUrl, parsers } = this.config;
        const { searchId } = event.pathParameters;
        const { locale } = event.queryStringParameters ? event.queryStringParameters : '';
        const path = locale ? '?lang=' + locale : '';
        const data = JSON.parse(
            await HttpHelper.doRequest(baseUrl + 'layout/' + searchId + path)
        );
        const parser = new parsers.searchDescription();
        const response = parser.parse({ data });
        return HttpHelper.returnOkResponse(response);
    };

    getTimeline = async (event: any, _context: any, _callback: any) => {
        const { baseUrl, parsers } = this.config;
        const { id } = event.pathParameters;
        const { locale } = event.queryStringParameters ? event.queryStringParameters : '';
        const path = locale ? '?lang=' + locale : '';
        const data = JSON.parse(
            await HttpHelper.doRequest(baseUrl + 'views/' + id + path)
        );
        const parser = new parsers.timeline();
        const response = parser.parse({ data });
        return HttpHelper.returnOkResponse(response);
    };

    getMap = async (event: any, _context: any, _callback: any) => {
        const { baseUrl, parsers } = this.config;
        const { id } = event.pathParameters;
        const { locale } = event.queryStringParameters ? event.queryStringParameters : '';
        const path = locale ? '?lang=' + locale : '';
        const data = JSON.parse(
            await HttpHelper.doRequest(baseUrl + 'views/' + id + path)
        );
        const parser = new parsers.map();
        const response = parser.parse({ data });
        return HttpHelper.returnOkResponse(response);
    };

    getResource = async (event: any, _context: any, _callback: any) => {
        const { baseUrl, parsers, configurations } = this.config;
        // change id whit slug and no un parameters but in the boy request  in POST
        let { type, id, sections } = JSON.parse(event.body);
        const requestURL = baseUrl;
        const url = requestURL + type + '/' + id;
        const { locale } = event.queryStringParameters ? event.queryStringParameters : '';
        const path = locale ? '?lang=' + locale : '';
        //remove, only for test
        const data = JSON.parse(await HttpHelper.doRequest(url + path));
        const parser = new parsers.resource();
        const response = parser.parse({
            data,
            options: {
                type,
                conf: configurations.resources[type],
            },
        });
        const sect = sortObj(response.sections, sections); // body sections filters
        response.sections = sect;

        // FIX ME: non serve il parser
        if (data.locale) {
            const parseLang = new ResourceParser();
            response.locale = parseLang.localeParse(data.locale);
        }
        // 
        return HttpHelper.returnOkResponse(response);
    };

    search = async (event: any, _context: any, _callback: any) => {
        const { parsers, searchIndex, elasticUri, configurations, defaultLang } = this.config;
        const body = JSON.parse(event.body); // cf. SEARCH-RESULTS in Postman
        const { type } = event.pathParameters;
        const { locale } = event.queryStringParameters ? event.queryStringParameters : '';
        let searchLangIndex = searchIndex;
        if (locale && defaultLang && locale != defaultLang) {
            searchLangIndex = searchIndex + '_' + locale
        }
        const params = ESHelper.buildQuery(body, configurations.search, type); // return main_query (cf. Basic Query Theatheor body JSON su Postman)
        // make query
        //console.log(JSON.stringify(params));
        const query_res: any = await ESHelper.makeSearch(
            searchLangIndex,
            params,
            Client,
            elasticUri
        );
        const data =
            type === 'results' ? query_res.hits.hits : query_res.aggregations;
        const parser = new parsers.search();
        const { searchId, facets } = body;
        const { limit, offset, sort } = body.results ? body.results : 'null';
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
                conf: configurations.search,
            },
        });

        return HttpHelper.returnOkResponse(response);
    };

    advancedSearch = async (event: any, _context: any, _callback: any) => {
       
        const body = JSON.parse(event.body); // cf. SEARCH-RESULTS in Postman
        const { locale } = event.queryStringParameters ? event.queryStringParameters : '';
        const controller = new controllers.advancedSearchController();
        
        const response = await controller.search(body, this.config, locale);
        return HttpHelper.returnOkResponse(response);
    };
    
    advancedSearchTextSearch = async (event: any, _context: any, _callback: any) => {
       
        const body = JSON.parse(event.body); // cf. SEARCH-RESULTS in Postman
        const { locale } = event.queryStringParameters ? event.queryStringParameters : '';
        const controller = new controllers.advancedSearchController();
        
        const response = await controller.advancedSearchTextSearch(body, this.config, locale);
        return HttpHelper.returnOkResponse(response);
    };
   
    teiPubGetNodePath = async (event: any, _context: any, _callback: any) => {
        const body = JSON.parse(event.body);
        const { locale } = event.queryStringParameters ? event.queryStringParameters : '';
        const controller = new controllers.teiPublisherController(this.config);
        return controller.teiPubGetNodePath(body, locale);     
    }
    
    advancedSearchOptions = async (event: any, _context: any, _callback: any) => {
        const {
            configurations,
            baseUrl,
            advancedSearchParametersPath
        } = this.config;

        const advanced_search_options = configurations.advanced_search.advanced_search?.dynamic_options;

        if (advanced_search_options) {
            const requestURL = baseUrl + advancedSearchParametersPath;;
            const { locale } = event.queryStringParameters ? event.queryStringParameters : '';
            const path = locale ? '?lang=' + locale : '';
            const data: any = await HttpHelper.doPostRequest(requestURL + path, advanced_search_options);
            const options = data.data;
            return HttpHelper.returnOkResponse(options);
        }


    }

    getFooter = async (_event: any, _context: any, _callback: any) => {
        const { baseUrl, parsers, configurations } = this.config;
        const { locale } = _event.queryStringParameters ? _event.queryStringParameters : '';
        const path = locale ? 'footer?lang=' + locale : 'footer';
        const data = JSON.parse(await HttpHelper.doRequest(baseUrl + path));
        const parser = new parsers.footer();
        const response = parser.parse(data, { conf: configurations.footer });
        return HttpHelper.returnOkResponse(response);
    };

    getTranslation = async (event: any, _context: any, _callback: any) => {
        const { baseUrl, parsers } = this.config;
        const { lang } = event.pathParameters;
        let queryLang = lang;
        if (lang && lang.length < 5) {
            queryLang = lang === 'en' ? lang + '_US' : lang + '_' + lang.toUpperCase();
        }
        const data = JSON.parse(
            await HttpHelper.doRequest(baseUrl + 'translations?lang=' + queryLang)
        );
        const parser = new parsers.translation();
        const response = parser.parse({
            data,
            options: {
                queryLang,
            },
        });
        return HttpHelper.returnOkResponse(response);
    };

    getStaticPage = async (event: any, _context: any, _callback: any) => {
        const { parsers, staticUrl } = this.config;
        const { slug } = event.pathParameters;
        const data = JSON.parse(
            await HttpHelper.doRequest(staticUrl + 'pages?' + 'slug=' + slug)
        );
        const parser = new parsers.static();
        const response = parser.parse({ data });
        if (response) {
            return HttpHelper.returnOkResponse(response);
        } else {
            return HttpHelper.returnErrorResponse('page not found', 404);
        }
    };

    getStaticPost = async (event: any, _context: any, _callback: any) => {
        const { parsers, staticUrl } = this.config;
        const { slug } = event.pathParameters;
        const data = JSON.parse(
            await HttpHelper.doRequest(staticUrl + 'posts?' + 'slug=' + slug)
        );
        const parser = new parsers.static();
        const response = parser.parse({ data });
        if (response) {
            return HttpHelper.returnOkResponse(response);
        } else {
            return HttpHelper.returnErrorResponse('page not found', 404);
        }
    };

    getTypeList = async (event: any, _context: any, _callback: any) => {
        const { parsers, staticUrl } = this.config;
        const { type } = event.pathParameters;
        const body = JSON.parse(event.body);

        let params = '';

        if (body.results && body.results.limit) {
            params = 'per_page=' + body.results.limit;
        }

        if (body.results && body.results.offset) {
            params +=
                params == ''
                    ? 'offset=' + body.results.offset
                    : '&offset=' + body.results.offset;
        }

        const apiUrl =
            params != '' ? staticUrl + type + '?' + params : staticUrl + type;
        const data = JSON.parse(await HttpHelper.doRequest(apiUrl));
        const parser = new parsers.static();

        const response: SearchResultsData = {
            results: parser.parseList({ data, options: { type } }),
            limit: body.results.limit || 10,
            offset: body.results.offset || 0,
            total_count: data.length,
            sort: '',
        };
        return HttpHelper.returnOkResponse(response);
    };

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
    };

    getItinerary = async (event: any, _context: any, _callback: any) => {
        const { parsers, baseUrl, configurations } = this.config;
        const { id } = event.pathParameters;
        const { locale } = event.queryStringParameters ? event.queryStringParameters : '';
        const path = locale ? '?lang=' + locale : '';
        const data = JSON.parse(
            await HttpHelper.doRequest(baseUrl + 'itinerary/' + id + path)
        );
        const parser = new parsers.itinerary(configurations?.itineraries);
        const response = parser.parse({ data });
        if (response) {
            return HttpHelper.returnOkResponse(response);
        } else {
            return HttpHelper.returnErrorResponse('page not found', 404);
        }
    };

    getSlsMethods() {
        return {
            postTest: this.postTest.bind(this),
            getTest: this.getTest.bind(this),
            getNavigation: this.getNavigation.bind(this),
            getFooter: this.getFooter.bind(this),
            getHomeLayout: this.getHomeLayout.bind(this),
            getSearchDescription: this.getSearchDescription.bind(this),
            getTimeline: this.getTimeline.bind(this),
            getMap: this.getMap.bind(this),
            getResource: this.getResource.bind(this),
            search: this.search.bind(this),
            advancedSearch: this.advancedSearch.bind(this),
            getTranslation: this.getTranslation.bind(this),
            getStaticPage: this.getStaticPage.bind(this),
            getStaticPost: this.getStaticPost.bind(this),
            getTypeList: this.getTypeList.bind(this),
            getItinerary: this.getItinerary.bind(this),
            getItineraries: this.getItineraries.bind(this),
            advancedSearchOptions: this.advancedSearchOptions.bind(this),
            teiPubGetNodePath: this.teiPubGetNodePath.bind(this),
        };
    }
}
