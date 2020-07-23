const { initTracer } = require("jaeger-client");
const { FORMAT_HTTP_HEADERS } = require("opentracing");
const request = require("./request")


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


var tracer=null

const Jaeger = (cfg={},opt={})=>{

    return (req,res,next)=>{
        if(tracer==null){
            defaultConfig = {...defaultConfig,...cfg}
            defaultOptions = {...defaultOptions,...opt}
            tracer = initTracer(defaultConfig, defaultOptions);
        }
        const parent = tracer.extract(FORMAT_HTTP_HEADERS, req.headers);
        const _config = parent ? { childOf: parent } : {};
        const span = tracer.startSpan(`${req.hostname}`, _config);
        span.setTag("route", req.path);
        req.span = span
        req.tracer = tracer
        req.request = request
        next();
    }
}

module.exports = Jaeger 
