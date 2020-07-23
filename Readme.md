# Express-Jaeger

**Jaeger middleware to request tracing for express application**

## Installation

```
npm i @chankamlam/express-jaeger -S
```

## Setup Infra
```
docker run -d -e COLLECTOR_ZIPKIN_HTTP_PORT=9411 -p5775:5775/udp -p6831:6831/udp -p6832:6832/udp \
  -p5778:5778 -p16686:16686 -p14268:14268 -p9411:9411 jaegertracing/all-in-one:latest
```

## Usage
```
const express = require("express");
const jaeger = require("@chankamlam/express-jaeger")
const app = express();

// setup config
const config = {
    serviceName: 'aservice-express',
    sampler: {
        type: "const",
        param: 1
    },
    reporter: {
        collectorEndpoint: "http://localhost:14268/api/traces"
    },
};

// setup options
const options = { baggagePrefix: "-Johua-" };

// using jager,after this it will has three objects(span,tracer,request)binding in req
app.use(jaeger(config,options));

app.get("/normalUsingSpan2Log", async function (req, res) {
    const span = req.span;
    span.log({event: "timestamp", value: Date.now()});
    span.finish();
    res.send({code: 200, msg: "success"});
});

app.get("/remoteCallingAndlogResult", async function (req, res) {
    const span = req.span;
    const result = await req.request("http://localhost:3001/bc", {
        tracer: req.tracer,
        rootSpan: req.span
      });
    span.logEvent("result",result)
    span.finish();
    res.send({code: 200, msg: "success"});
});

app.listen(3000, '127.0.0.1', function () {
    console.log('start server...');
});

```

## Config
```
{
  serviceName: "string",
  disable: "boolean",
  sampler: {
    type: "string", // required
    param: "number", // required
    hostPort: "string",
    host: "string",
    port: "number",
    refreshIntervalMs: "number"
  },
  reporter: {
    logSpans: "boolean",
    agentHost: "string",
    agentPort: "number",
    collectorEndpoint: "string",
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
```
```