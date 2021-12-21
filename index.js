const { initTracer } = require("jaeger-client");
const { FORMAT_HTTP_HEADERS, Tags } = require("opentracing");
const axios = require("axios")
const process = require("process")

const TAGS = {
  ...Tags,
  "PROTOCAL": "protocal",
  "TRACING_TAG": "tracing-tag",
}

const UNKNOW = 'Unknow'
const STRING = 'string'

const DEFAULT_SAMPLER = {
  type: "const",
  param: 1
};

const DEFAULT_REPORTER = {
  collectorEndpoint: "http://localhost:14268/api/traces",
};

const DEFAULT_LOGGER = {
  info: msg => {
    console.log("JAEGER INFO ", msg);
  },
  error: msg => {
    console.log("JAEGER ERROR", msg);
  }
};

const DEFAULT_OPTIONS = { logger: DEFAULT_LOGGER };

const DAFAULT_CONFIG = {
  serviceName: UNKNOW,
  reporter: DEFAULT_REPORTER,
  sampler: DEFAULT_SAMPLER
};

// tracer instance
var tracer = null

// tracing tag form request and  will send to remote call
var tracing_tag = {}

/**
 * Inject tracing tag to headers for remote call
 * @param {*} opts 
 */
const injectSpan = (span, opts = undefined) => {
  var headers = {}
  headers[TAGS.TRACING_TAG] = JSON.stringify(tracing_tag)
  tracer.inject(span, FORMAT_HTTP_HEADERS, headers);
  if (opts == undefined) {
    opts = { headers }
  } else if (typeof (opts) == STRING) {
    opts = { headers, url: opts }
  } else {
    opts.headers = { ...opts.headers, ...headers }
  }
  return opts
}

/**
 * print log
 * @param {string} title 
 * @param {string} msg 
 */
const printMsg = function (title, msg) {
  console.log(`=>${title}:`)
  console.log(msg)
}

/**
 * create a jaeger instance
 */
const createJaegerInstance = (span) => {
  return {
    // span instance
    span,

    // tracer instance
    tracer,

    // TAGS of opentracing
    tags: TAGS,

    // use for remote call
    axios: ((opts = undefined) => {
      return (function () {
        let obj = function (opts) {
          // handle tracing header
          var options = injectSpan(span, opts)
          return axios(options)
        }
        for (const key in axios) {
          if (axios.hasOwnProperty(key)) {
            const element = axios[key];
            obj[key] = function () {
              if (arguments.length == 0) {
                arguments = injectSpan(span, {})
              }
              else if (arguments.length == 1 && typeof (arguments[0]) == STRING) {
                arguments[1] = injectSpan(span, arguments[0])
              }
              else if (arguments.length == 1 && typeof (arguments[0]) != STRING) {
                arguments[0] = injectSpan(span, arguments[0])
              }
              else if (arguments.length == 2) {
                arguments[1].url = arguments[0]
                arguments[1] = injectSpan(span, arguments[1])
              }
              else if (arguments.length == 3) {
                arguments[2].data = arguments[1]
                arguments[2].url = arguments[0]
                arguments[2] = injectSpan(span, arguments[2])
              }
              return element.apply(null, Array.prototype.slice.call(arguments))
            }
          }
        }
        return obj
      })()
    })(),

    // log
    log: (name, content) => {
      if (!span) return
      span.logEvent(name, content)
    },

    // setup tag
    setTag: (tag, val) => {
      if (!span) return
      span.setTag(tag, val)
    },

    // setup mutiple TAGS
    addTags: (obj) => {
      if (!span || !obj) return
      span.addTags(obj)
    },

    // setup tracing tag which can pass through all remote call by using Jaeger.request
    setTracingTag: (tag, val) => {
      if (!span) return
      span.setTag(tag, val)
      tracing_tag[tag] = val
    },

    // finish span job
    finish: () => {
      if (!span) return
      span.finish()
    },

    // create new span under master span
    createSpan: (name, parent) => {
      const parentObj = parent
        ? { childOf: parent }
        : { childOf: span };
      if (!tracer) return
      return tracer.startSpan(name, parentObj)
    }
  }
}

/**
 * init tracer
 */
const initiateTracer = (cfg = {}, opt = {}) => {
  if (!tracer) {
    const config = { ...DAFAULT_CONFIG, ...cfg }
    const options = { ...DEFAULT_OPTIONS, ...opt }
    tracer = initTracer(config, options);
  }
}

var Jaeger = (cfg = {}, opt = {}, cb = undefined) => {

  ////////////////////////////////////////////////////////////////////
  ///
  /// SPECIAL CASE HANDLE
  ///
  ///////////////////////////////////////////////////////////////////
  // pass for CI
  if (process.env && process.env["CI_RUNNER_ID"]) {
    return (req, res, next) => { next() }
  }

  // for using in directive
  if (!cfg || !opt) {
    initiateTracer(cfg, opt)
    return createJaegerInstance()
  }
  ////////////////////////////////////////////////////////////////////

  // for using in express
  return (req, res, next) => {

    // master span
    var span = null;

    initiateTracer(cfg, opt)

    // check exclude array
    if (opt && opt["excludePath"] && opt["excludePath"] instanceof Array) {
      let arr = opt["excludePath"]
      let isPass = false
      for (let i = 0; i < arr.length; i++) {
        const path = arr[i];
        const regex = new RegExp(path)
        if (regex.test(req.path)) {
          isPass = true
          break
        }
      }
      if (isPass) {
        next()
        return
      }
    }
    ////////////////////////////////////////////////////


    // extract parent span from headers of request
    const extractSpan = () => {
      if (!tracer) {
        throw new Error(`[*]Initiate tracer... [FAILED]`)
      }
      var parent = tracer.extract(FORMAT_HTTP_HEADERS, req.headers);
      parent = parent ? { childOf: parent } : {};
      span = tracer.startSpan(req.path, parent);
    }
    extractSpan()
    ////////////////////////////////////////////////////////////////


    // extract tracing tag from headers of request
    const extractTracingTag = () => {
      if (!span) {
        throw new Error(`[*]Initiate master span... [FAILED]`)
      }
      if (req.headers && req.headers[TAGS.TRACING_TAG]) {
        tracing_tag = JSON.parse(req.headers[TAGS.TRACING_TAG])
      }
      for (const key in tracing_tag) {
        const val = tracing_tag[key];
        span.setTag(key, val);
      }
    }
    extractTracingTag()
    ///////////////////////////////////////////////


    // binding jaeger instance to req
    req.jaeger = createJaegerInstance(span)


    // handle callback function which open to programer
    if (cb) {
      cb(req, res)
    }
    ///////////////////////////////////////////////////


    // mark default tag of request
    req.jaeger.setTag("request.ip", req.ip || UNKNOW)
    req.jaeger.setTag("request.method", req.method || UNKNOW)
    req.jaeger.setTag("request.headers", req.headers || UNKNOW)
    req.jaeger.setTag("request.path", req.path || UNKNOW)
    req.jaeger.setTag("request.body", req.body || UNKNOW)
    req.jaeger.setTag("request.query", req.query || UNKNOW)
    /////////////////////////////////////////////////////

    res.once("finish", () => {
      //mark default tag of response
      req.jaeger.setTag("response.state", res.statusCode || UNKNOW);
      req.jaeger.setTag("response.result", res.statusMessage || UNKNOW);
    });

    // auto finish for master span
    res.once("close", () => {
      req.jaeger.finish()
    });
    /////////////////////////////////////////////////////

    next();
  }
}

module.exports = Jaeger 
