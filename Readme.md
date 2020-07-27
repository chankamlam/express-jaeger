# Express-Jaeger
```

                                         _                            
  _____  ___ __  _ __ ___  ___ ___      (_) __ _  ___  __ _  ___ _ __ 
 / _ \ \/ / '_ \| '__/ _ \/ __/ __|_____| |/ _` |/ _ \/ _` |/ _ \ '__|
|  __/>  <| |_) | | |  __/\__ \__ \_____| | (_| |  __/ (_| |  __/ |   
 \___/_/\_\ .__/|_|  \___||___/___/    _/ |\__,_|\___|\__, |\___|_|   
          |_|                         |__/            |___/           

```
**Jaeger middleware to request tracing for express application**

# Required Reading 

#### _Opentracing_ 
   _To fully understand Opentracing, it's helpful to be familiar with the [OpenTracing project](http://opentracing.io) and
[terminology](http://opentracing.io/documentation/pages/spec.html) more specifically._

#### _Jaeger(One Of Request Tracing System implement Opentracing)_
   _To fully understand Jaeger, it's helpful to be familiar with the [Jaeger project](https://www.jaegertracing.io) and [Jaeger Client for Node](https://www.npmjs.com/package/jaeger-client)_

# Simple Concept
![avatar](https://www.jaegertracing.io/img/spans-traces.png)

> #### _One request map to one trace_

> #### _One trace atleast has one span which is master span_

> #### _Master span can have many children spans_



# Installation

```
npm i @chankamlam/express-jaeger -S
```

## Architecture of Jaeger Server

> ### _for development_
![avatar](https://www.jaegertracing.io/img/architecture-v1.png)

> ### _for prodution_
![avatar](https://www.jaegertracing.io/img/architecture-v2.png)

> ### _Build up Jaeger Server Infra locally(development env)_

```
docker run -d -e COLLECTOR_ZIPKIN_HTTP_PORT=9411 -p5775:5775/udp -p6831:6831/udp -p6832:6832/udp \
  -p5778:5778 -p16686:16686 -p14268:14268 -p9411:9411 jaegertracing/all-in-one:latest
```

# Quick Start
```
const express = require("express");
const jaeger = require("@chankamlam/express-jaeger");
const app = express();

const config = {
    serviceName: 'service1-express',
    sampler: {
        type: "const",
        param: 1
    },
    reporter: {
        collectorEndpoint: "http://localhost:14268/api/traces"
    },
};                                             // required
const options = { baggagePrefix: "-Johua-" };  // optional,you can let options={}

app.use(express.json()) // for parsing application/json
app.use(express.urlencoded({ extended: true })) // for parsing application/
x-www-form-urlencoded

app.use(jaeger(config,options,(req,res)=>{
   // here to write your code
   // which is showing here is to auto record query/body/path for every request
    const jaeger = req.jaeger
    jaeger.setTag("route",req.path)
    jaeger.setTag("body",req.body)
    jaeger.setTag("query",req.query)
}));

app.all("/abc", async function (req, res) {
    res.send({code: 200, msg: result});
});

app.listen(3000, '127.0.0.1', function () {
    console.log('start');
});
```
# Usage
## _normallyUsingSpan2Log_
```
const express = require("express");
const jaeger = require("@chankamlam/express-jaeger")
const app = express();

// setup config, atleast need this param
const config = {
    serviceName: 'aservice-express',                              // your service name
    sampler: {                                                    // setup sampler
        type: "const",
        param: 1
    },
    reporter: {
        collectorEndpoint: "http://localhost:14268/api/traces"    // your jaeger server endpoint
    },
};

// setup options, defaut is {}
const options = { baggagePrefix: "-Johua-" };

/*  
 *  using jager,after this it will has one object which called jaeger,
 *  with four properties(span,tracer,request,tags) binding in req
 */
app.use(jaeger(config,options));

app.get("/normallyUsingSpan2Log", async function (req, res) {
    const jaeger = req.jaeger;
    jaeger.log("timestamp",Date.now());
    res.send({code: 200, msg: "success"});
});
app.listen(3000, '127.0.0.1', function () {
    console.log('start server...');
});
```
## _usingSpan2LogWithError_
```
app.get("/errorUsingSpan2Log", async function (req, res) {
    const jaeger = req.jaeger;
    const tags = req.jaeger.tags;
    try {
      throw Error("err");           // create exception to test
    } catch (err) {
      jaeger.setTag(tags.ERROR, true);   // diaplay to JaegerUI when you mark tag as "error"
      jaeger.log("errorMsg", err.message);
    }
    res.send({code: 200, msg: "success"});
});
```
## _remoteCallingAndlogResult_
```
app.get("/remoteCallingAndlogResult", async function (req, res) {
    const jaeger = req.jaeger
    // for remote request, you have to use jaeger.axios which wrap axios by tracing
    const result = await jaeger
                         .axios({url:"http://localhost:3001/bc"})
                         .then(r=>r.data);
    jaeger.log("result",result)
    res.send({code: 200, msg: "success"});
});
```
## _remoteCallingAndlogResultInTwoSpan_
```
app.get("/remoteCallingAndlogResultInTwoSpan", async function (req, res) {

    const jaeger = req.jaeger

    // default under master span (auto create by every request)
    const span1 = jaeger.createSpan("resut1")
    const result1 = await jaeger
                          .axios({url:"http://localhost:3001/a"})
                          .then(r=>r.data);
    span1.log("result1",result1)
    span1.finish();

    // default under master span (auto create by every request)
    const span2 = jaeger.createSpan("resut2")
    const result2 = await jaeger
                          .axios({url:"http://localhost:3001/b",method:"post",data:{}})
                          .then(r=>r.data);
    span2.log("result2",result2)
    span2.finish();

    jaeger.log("resultOfMasterSpan","here is master span")
    res.send({code: 200, msg: "success"});
});

```
# Lookup Request Tracing

> open url  http://localhost:16686 , remember to build up the Jager Server locally first

![avatar](https://raw.githubusercontent.com/chankamlam/express-jaeger/master/pic/1.png)
![avatar](https://raw.githubusercontent.com/chankamlam/express-jaeger/master/pic/2.png)


# Object Detail

## _Config_
> for detail, pls look up to [Jaeger Client for Node](https://www.npmjs.com/package/jaeger-client)
```
{
  serviceName: "string",           // required
  disable: "boolean",
  sampler: {
    type: "string",                // required
    param: "number",               // required
    hostPort: "string",
    host: "string",
    port: "number",
    refreshIntervalMs: "number"
  },
  reporter: {
    logSpans: "boolean",
    agentHost: "string",
    agentPort: "number",
    collectorEndpoint: "string",   // required
    username: "string",
    password: "string",
    flushIntervalMs: "number"
  },
  throttler: {
    host: "string",
    port: "number",
    refreshIntervalMs: "number"
  }
}
```

## _options_
> for detail, pls look up to [Jaeger Client for Node](https://www.npmjs.com/package/jaeger-client)
```
{
    contextKey: "string",
    baggagePrefix: "string",
    metrics: "object", // a metrics
    logger: "object",  // a logger
    tags: "object",    // set of key-value pairs which will be set as process-level tags on the Tracer itself.
    traceId128bit: "boolean",
    shareRpcSpan: "boolean",
    debugThrottler: "boolean",
}
```

## _jaeger_
> jaeger object will bind in req when you do "app.use(jaeger(config,options))"
```
{
  log           : function(name,content)    // write the log to master span
  setTag        : function(name,value)      // setup tag to master span
  setTracingTag : function(name,value)      // setup tag to master span and children span 
  addTags       : function({k1:v1,k2:v2})   // setup mutiple tags to master span
  createSpan    : function(name)            // create a new span un der master span
  tags          : object                    // all defined tags of opentracing which can be used
  axios         : function(url,options)     // using it to remote call service if not it will be broken the tracing to next service
}
```
### _log_
```
req.jaeger.log("info","..........")
```
### _setTag_
```
const jaeger = req.jaeger
const tags = jaeger
// using defined tags by opentracing
jaeger.setTag(tags.ERROR,true)
// using your customize tag
jaeger.setTag("warning",true)

```
### _setTag_
```
const jaeger = req.jaeger
const tags = jaeger
jaeger.setTracingTag("waybill","wb-123456")
```
### _addTags_
```
const jaeger = req.jaeger
const tags = jaeger
// add mutiple tag one time
jaeger.addTags({"error":true,"info":true})
```
### _createSpan_
```
const span = jaeger.createSpan("subSpanName")   // create a sub span under master span
// you also can call method of span
span.log("info","info......")
span.setTag("info",true)
// remember to call finish() if not there is no record send to jaeger
span.finish();
```
### _tags_
defined tag, some come from [OpenTracing project](http://opentracing.io)
### _axios_
jaeger.axios wrap axios with tracing header, for usage detail pls look up to [axios](https://www.npmjs.com/package/axios)
## license
MIT