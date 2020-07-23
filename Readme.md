# Express-Jaeger

**Jaeger middleware to request tracing for express application**

## Required Reading Opentracing 
To fully understand Opentracing, it's helpful to be familiar with the [OpenTracing project](http://opentracing.io) and
[terminology](http://opentracing.io/documentation/pages/spec.html) more specifically.
## Required Reading Jaeger 
To fully understand Jaeger, it's helpful to be familiar with the [Jaeger project](https://www.jaegertracing.io) and [Jaeger Client for Node](https://www.npmjs.com/package/jaeger-client)

## Installation

```
npm i @chankamlam/express-jaeger -S
```

## Architecture of Jaeger Server
for development
![avatar](https://www.jaegertracing.io/img/architecture-v1.png)
for prodution
![avatar](https://www.jaegertracing.io/img/architecture-v2.png)

## Build up Jaeger Server Infra locally(development env)
```
docker run -d -e COLLECTOR_ZIPKIN_HTTP_PORT=9411 -p5775:5775/udp -p6831:6831/udp -p6832:6832/udp \
  -p5778:5778 -p16686:16686 -p14268:14268 -p9411:9411 jaegertracing/all-in-one:latest
```


## Usage
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

app.get("/normalUsingSpan2Log", async function (req, res) {
    const jaeger = req.jaeger;
    jaeger.log("timestamp",Date.now());
    jaeger.finish();
    res.send({code: 200, msg: "success"});
});

app.get("/errorUsingSpan2Log", async function (req, res) {
    const jaeger = req.jaeger;
    const tags = req.jaeger.tags;
    try {
      throw Error("err");           // create exception to test
    } catch (err) {
      jaeger.setTag(tags.ERROR, true);   // diaplay to JaegerUI when you mark tag as "error"
      jaeger.log("errorMsg", err.message);
    }
    jaeger.finish();
    res.send({code: 200, msg: "success"});
});

app.get("/remoteCallingAndlogResult", async function (req, res) {
    const jaeger = req.jaeger
    // for remote request, you have to use jaeger.request which wrap request by tracing
    const result = await jaeger.request("http://localhost:3001/bc");
    jaeger.log("result",result)
    jaeger.finish();
    res.send({code: 200, msg: "success"});
});

app.get("/remoteCallingAndlogResultInTwoSpan", async function (req, res) {

    const jaeger = req.jaeger

    // default under master span (auto create by every request)
    const span1 = jaeger.createSpan("resut1")
    const result1 = await jaeger.request("http://localhost:3001/a");
    span1.log("result1",result1)
    span1.finish();

    // default under master span (auto create by every request)
    const span2 = jaeger.createSpan("resut2")
    const result2 = await jaeger.request("http://localhost:3001/b");
    span2.log("result2",result2)
    span2.finish();

    jaeger.log("resultOfMasterSpan","here is master span")
    Jaeger.finish()


    res.send({code: 200, msg: "success"});
});



app.listen(3000, '127.0.0.1', function () {
    console.log('start server...');
});

```
## Lookup Request Tracing

open url  http://localhost:16686 , remember to build up the Jager Server locally first

![avatar](https://raw.githubusercontent.com/chankamlam/express-jaeger/master/pic/1.png)
![avatar](https://raw.githubusercontent.com/chankamlam/express-jaeger/master/pic/2.png)

## Config
for what is usage of the param, pls look up to "jaeger-client"
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

## options
for what is usage of the param, pls look up to "jaeger-client"
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

## jaeger
```
{
  log        : function(name,content)    // write the log to master span
  setTag     : function(name,Value)      // setup tag to master span
  createSpan : function(name)            // create a new span un der master span
  finish     : function()                // master span finished
  tracer     : object
  span       : object
  tags       : object                    // all defined tags of opentracing which can be used
}
```

## license
MIT