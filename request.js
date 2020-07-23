const Request = require("request");
const { FORMAT_HTTP_HEADERS ,Tags} = require("opentracing");
const noop = () => {};

// request
const request = (url, options) => {
  const method = (options && options.method) || "GET";
  const headers = (options && options.headers) || {};
  const tracer = (options && options.tracer) || { inject: noop, setTag: noop };
  const rootSpan = (options && options.rootSpan) || {};
  // const _config = rootSpan ? { childOf: rootSpan } : {};
  // const span = tracer.startSpan(`${url}`, _config);
  // span.setTag(Tags.HTTP_URL, url);
  // span.setTag(Tags.HTTP_METHOD, method);
  // tracer.inject(span, FORMAT_HTTP_HEADERS, headers);
  tracer.inject(rootSpan, FORMAT_HTTP_HEADERS, headers);
  const promise = new Promise((resolve, reject) => {
    Request(
      {
        url: url,
        method: method,
        headers: headers
      },
      (err, res, body) => {
        // span.finish();
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