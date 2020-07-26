const { initTracer } = require("jaeger-client");
const debug = require('debug')("log")
const { FORMAT_HTTP_HEADERS,Tags } = require("opentracing");
const axios = require("axios")

const tags = {
  ...Tags,
  "PROTOCAL":"protocal",
  "TRACING_TAG":"tracing-tag",
}

const defaultSampler = {
  type: "const",
  param: 1
};

const defaultReporter = {
  collectorEndpoint: "http://localhost:14268/api/traces",
};

const defaultLogger = {
  info: msg => {
    console.log("JAEGER INFO ", msg);
  },
  error: msg => {
    console.log("JAEGER ERROR", msg);
  }
};

const defaultOptions = { logger: defaultLogger };

const defaultConfig =  {
  serviceName:"Unknow",
  reporter: defaultReporter,
  sampler: defaultSampler
};


var tracer  = null


var span = null


var tracing_tag = {}


const createJaegerInstance = ()=>{
  return {
    // span instance
    span,
    // tracer instance
    tracer,
    // tags of opentracing
    tags,
    // use for remote call
    axios : (opts=undefined)=>{
      if(!opts) return
      // handle tracing tag
      var options = {}
      var headers = {}
      headers[tags.TRACING_TAG] = JSON.stringify(tracing_tag)
      tracer.inject(span, FORMAT_HTTP_HEADERS, headers);
      opts.headers = {...opts.headers,...headers}
      options = {...opts}
      debug("==========request headers======")
      debug(opts.headers)
      return axios(options)
    },
    // log
    log:(name,content)=>{
      if(!span) return
      span.logEvent(name,content)
    },
    // setup tag
    setTag:(tag,val)=>{
      if(!span) return
      span.setTag(tag,val)
    },
    // setup mutiple tags
    addTags:(obj)=>{
      if(!span && !obj) return
      span.addTags(obj)
    },
    // setup tracing tag which can pass through all remote call by using Jaeger.request
    setTracingTag:(tag,val)=>{
      if(!span) return
      span.setTag(tag,val)
      tracing_tag[tag] = val
      debug("===== tracing_tag =====")
      debug(tracing_tag)
    },
    // finish span job
    finish:()=>{
      if(!span) return
      span.finish()
    },
    // create new span under master span
    createSpan:(name)=>{
      if(!tracer) return
      return tracer.startSpan(name,{ childOf:span })
    }
  }
}

var Jaeger = (cfg=undefined,opt=undefined,cb=undefined)=>{
    
    // for direct using
    if(!cfg||!opt){
      debug("get instance by module...")
      return createJaegerInstance()
    }

    // for express using
    return (req,res,next)=>{
        // init tracer
        if(!tracer){
            const config = {...defaultConfig,...cfg}
            const options = {...defaultOptions,...opt}
            tracer = initTracer(config, options);
        }else{
          debug("tracer already exsited")
        }

        if(!tracer) return
        // extract http/https headers
        var parent = tracer.extract(FORMAT_HTTP_HEADERS, req.headers);
        parent = parent ? { childOf: parent } : {};
        span = tracer.startSpan(req.headers.host+req.path, parent);
        debug("===== headers =====")
        debug(req.headers)

        if(!span) return
        // handle tracing tag
        if(req.headers&&req.headers[tags.TRACING_TAG]){
          tracing_tag = JSON.parse(req.headers[tags.TRACING_TAG])
        }
        for (const key in tracing_tag) {
            const val = tracing_tag[key];
            span.setTag(key, val);
        }
        debug("===== tracing_tag =====")
        debug(tracing_tag)

        // binding jaeger instance to req
        req.jaeger = createJaegerInstance()

        // handle callback function which open to programer
        if(cb){
          cb(req,res)
        }

        // mark default tag of request
        req.jaeger.setTag("request.ip",req.ip)
        req.jaeger.setTag("request.method",req.method)
        req.jaeger.setTag("request.headers",req.headers)
        req.jaeger.setTag("request.path",req.path)
        req.jaeger.setTag("request.body",req.body)
        req.jaeger.setTag("request.query",req.query)
        next();

        // auto finish for master span
        res.once("finish", () => {
          //mark default tag of response
          req.jaeger.setTag("response.state", res.statusCode);
          req.jaeger.setTag("response.result", res.statusMessage);
          req.jaeger.finish()
        });
    }
}

module.exports = Jaeger 
