const { initTracer } = require("jaeger-client");
const { FORMAT_HTTP_HEADERS,Tags } = require("opentracing");
const request = require("./request")

tags = {
  ...Tags,
  "PROTOCAL":"protocal"
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

const createSpan = (spanName,cfg)=>{
  if(tracer==null) return
    return tracer.startSpan(spanName,cfg)
}

const Jaeger = (cfg={},opt={})=>{

    return (req,res,next)=>{
        if(tracer==null){
            const config = {...defaultConfig,...cfg}
            const options = {...defaultOptions,...opt}
            tracer = initTracer(config, options);
            console.log("init tracer...Done")
        }
        var parent = tracer.extract(FORMAT_HTTP_HEADERS, req.headers);
        parent = parent ? { childOf: parent } : {};
        span = tracer.startSpan(req.hostname+req.originalUrl, parent);
        span.setTag("route", req.path);
        span.setTag(tags.PROTOCAL,req.protocol)
        span.setTag(tags.HTTP_METHOD,req.method)
        // span.setTag(tags.HTTP_URL,"asas")
        req.jaeger = {
          span,
          tracer,
          tags,
          request : (url)=>{
            return request(url,{
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
          finish:()=>{
            span.finish()
          },
          createSpan:(name)=>{
            return tracer.startSpan(name,{ childOf:span })
          }
        }
        console.log("init span...Done")
        next();
    }
}

module.exports = Jaeger 
