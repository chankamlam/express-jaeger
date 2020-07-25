const Request = require("request");
const { FORMAT_HTTP_HEADERS ,Tags} = require("opentracing");
const noop = () => {};

// request
const request = (url, options) => {
  const method = (options && options.method) || "GET";
  const headers = (options && options.headers) || {};
  const tracer = (options && options.tracer) || { inject: noop, setTag: noop };
  const rootSpan = (options && options.rootSpan) || {};
  const body = (options && options.body) || {}
  const defaultContentType = {"Content-Type":"application/json"}
  tracer.inject(rootSpan, FORMAT_HTTP_HEADERS, headers);
  const promise = new Promise((resolve, reject) => {
    Request(
      {
        url: url,
        method: method,
        headers: {...defaultContentType,...headers},
        body:JSON.stringify(body)
      },
      (err, res, body) => {
        if (err) {
          console.log("request error : ", err);
          reject(err);
        } else {
          resolve(body);
        }
      }
    );
  });
  return promise;
};

module.exports = request