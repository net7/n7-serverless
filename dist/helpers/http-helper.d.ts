import { HTTPHeaders, HTTPResponse } from "../interfaces/helper";
export declare const HttpHelper: {
    returnOkResponse(data: object, headerData?: HTTPHeaders): HTTPResponse;
    returnErrorResponse(message: string, code: number): HTTPResponse;
    doRequest(url: string): Promise<string>;
};
