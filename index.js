const { initTracer } = require("jaeger-client");
const debug = require('debug')("log")
const { FORMAT_HTTP_HEADERS,Tags } = require("opentracing");
const request = require("./request")

tags = {
  ...Tags,
  "PROTOCAL":"protocal",
  "TRACING_TAG":"tracing_tag"
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

var defaultOptions = { logger: defaultLogger };

var defaultConfig =  {
  serviceName:"Unknow",
  reporter: defaultReporter,
  sampler: defaultSampler
};


var tracer  = null


var span = null

var tracing_tag = {}


var Jaeger = null
Jaeger = (cfg={},opt={},cb=undefined)=>{

    return (req,res,next)=>{
        if(tracer==null){
            const config = {...defaultConfig,...cfg}
            const options = {...defaultOptions,...opt}
            tracer = initTracer(config, options);
        }else{
          console.log("tracer already exsited")
        }
        var parent = tracer.extract(FORMAT_HTTP_HEADERS, req.headers);
        parent = parent ? { childOf: parent } : {};
        span = tracer.startSpan(req.headers.host+req.path, parent);

        debug("===== headers =====")
        debug(req.headers)
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



        const jaeger = {
          span,
          tracer,
          tags,
          request : (url,opts={})=>{
            // handle tracing tag
            const headers = {}
            headers[tags.TRACING_TAG] = JSON.stringify(tracing_tag)
            opts.headers = {...opts.headers,...headers}
            debug("==========request headers======")
            debug(opts.headers)
            return request(url,{...opts,
              tracer: tracer,
              rootSpan: span
            })
          },
          log:(name,content)=>{
            span.logEvent(name,content)
          },
          setTag:(tag,val)=>{
            span.setTag(tag,val)
          },
          addTags:(obj)=>{
            span.addTags(obj)
          },
          setTracingTag:(tag,val)=>{
            span.setTag(tag,val)
            tracing_tag[tag] = val
            debug("===== tracing_tag =====")
            debug(tracing_tag)
          },
          finish:()=>{
            span.finish()
          },
          createSpan:(name)=>{
            return tracer.startSpan(name,{ childOf:span })
          }
        }
        req.jaeger = jaeger
        Jaeger.tracer=tracer
        Jaeger.span=span
        if(cb){
          cb(req,res)
        }
        next();
        jaeger.finish()
    }
}

module.exports = Jaeger 
