"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SearchParser = void 0;
class SearchParser {
    parse({ data, options }) {
        const { type } = options;
        return type === 'results'
            ? this.parseResults({ data, options })
            : this.parseFacets({ data, options });
    }
    parseResults({ data, options }) {
        if (options && "limit" in options) {
            var { offset, limit, sort, total_count } = options;
        }
        const search_result = {
            limit,
            offset,
            sort,
            total_count,
            results: []
        };
        search_result.results = this.parseResultsItems({ data, options });
        return search_result;
    }
    parseFacets({ data, options }) {
        let global_sum = 0;
        const { facets } = options;
        const agg_res = {
            total_count: 0,
            facets: {}
        };
        facets.forEach(({ id, query }) => {
            let sum = 0;
            let filteredTotal = 0;
            let values = [];
            if (data[id]) {
                let buckets_data = getBucket(data[id]);
                if (buckets_data && buckets_data.buckets) {
                    buckets_data.buckets.forEach((agg) => {
                        const haystack_formatted = (agg.key.split("|||")[0] || '').toLowerCase();
                        const haystack_notFormatted = (agg.key.split("|||")[1] || '').toLowerCase();
                        const needle = (query || '').toLowerCase();
                        if (haystack_formatted.includes(needle) || haystack_notFormatted.includes(needle)) {
                            values.push({
                                text: agg.key.split("|||")[1],
                                counter: agg.doc_count,
                                payload: agg.key.split("|||")[0]
                            });
                            filteredTotal += 1;
                        }
                        sum = sum + 1;
                    });
                }
            }
            global_sum += sum;
            agg_res.facets[id] = {
                total_count: sum,
                filtered_total_count: filteredTotal,
                values,
            };
            agg_res.total_count = global_sum;
        });
        // pagination chunk
        facets
            .forEach(facet => {
            agg_res.facets[facet.id].values = agg_res.facets[facet.id].values.slice(facet.offset, facet.offset + facet.limit);
        });
        return agg_res;
    }
}
exports.SearchParser = SearchParser;
function getBucket(data) {
    let keys = Object.keys(data);
    var bucketData;
    if (keys.includes("buckets")) {
        return data;
    }
    else {
        keys.forEach(k => { if (typeof data[k] === "object")
            bucketData = getBucket(data[k]); });
    }
    if (bucketData && bucketData.buckets) {
        return bucketData;
    }
}
