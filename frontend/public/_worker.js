// node_modules/hono/dist/compose.js
var compose = (middleware, onError, onNotFound) => {
  return (context, next) => {
    let index = -1;
    return dispatch(0);
    async function dispatch(i) {
      if (i <= index) {
        throw new Error("next() called multiple times");
      }
      index = i;
      let res;
      let isError = false;
      let handler;
      if (middleware[i]) {
        handler = middleware[i][0][0];
        context.req.routeIndex = i;
      } else {
        handler = i === middleware.length && next || void 0;
      }
      if (handler) {
        try {
          res = await handler(context, () => dispatch(i + 1));
        } catch (err) {
          if (err instanceof Error && onError) {
            context.error = err;
            res = await onError(err, context);
            isError = true;
          } else {
            throw err;
          }
        }
      } else {
        if (context.finalized === false && onNotFound) {
          res = await onNotFound(context);
        }
      }
      if (res && (context.finalized === false || isError)) {
        context.res = res;
      }
      return context;
    }
  };
};

// node_modules/hono/dist/request/constants.js
var GET_MATCH_RESULT = /* @__PURE__ */ Symbol();

// node_modules/hono/dist/utils/buffer.js
var bufferToFormData = (arrayBuffer, contentType) => {
  const response = new Response(arrayBuffer, {
    headers: {
      // Normalize the media type (case-insensitive) while keeping parameters like the boundary
      "Content-Type": contentType.replace(/^[^;]+/, (mediaType) => mediaType.toLowerCase())
    }
  });
  return response.formData();
};

// node_modules/hono/dist/utils/body.js
var isRawRequest = (request) => "headers" in request;
var parseBody = async (request, options = /* @__PURE__ */ Object.create(null)) => {
  const { all = false, dot = false } = options;
  const headers = isRawRequest(request) ? request.headers : request.raw.headers;
  const contentType = headers.get("Content-Type");
  const mediaType = contentType?.split(";")[0].trim().toLowerCase();
  if (mediaType === "multipart/form-data" || mediaType === "application/x-www-form-urlencoded") {
    return parseFormData(request, { all, dot });
  }
  return {};
};
async function parseFormData(request, options) {
  const headers = isRawRequest(request) ? request.headers : request.raw.headers;
  const arrayBuffer = await request.arrayBuffer();
  const formDataPromise = bufferToFormData(arrayBuffer, headers.get("Content-Type") || "");
  if (!isRawRequest(request)) {
    request.bodyCache.formData = formDataPromise;
  }
  const formData = await formDataPromise;
  if (formData) {
    return convertFormDataToBodyData(formData, options);
  }
  return {};
}
function convertFormDataToBodyData(formData, options) {
  const form = /* @__PURE__ */ Object.create(null);
  formData.forEach((value, key) => {
    const shouldParseAllValues = options.all || key.endsWith("[]");
    if (!shouldParseAllValues) {
      form[key] = value;
    } else {
      handleParsingAllValues(form, key, value);
    }
  });
  if (options.dot) {
    Object.entries(form).forEach(([key, value]) => {
      const shouldParseDotValues = key.includes(".");
      if (shouldParseDotValues) {
        handleParsingNestedValues(form, key, value);
        delete form[key];
      }
    });
  }
  return form;
}
var handleParsingAllValues = (form, key, value) => {
  if (form[key] !== void 0) {
    if (Array.isArray(form[key])) {
      ;
      form[key].push(value);
    } else {
      form[key] = [form[key], value];
    }
  } else {
    if (!key.endsWith("[]")) {
      form[key] = value;
    } else {
      form[key] = [value];
    }
  }
};
var handleParsingNestedValues = (form, key, value) => {
  if (/(?:^|\.)__proto__\./.test(key)) {
    return;
  }
  let nestedForm = form;
  const keys = key.split(".");
  keys.forEach((key2, index) => {
    if (index === keys.length - 1) {
      nestedForm[key2] = value;
    } else {
      if (!nestedForm[key2] || typeof nestedForm[key2] !== "object" || Array.isArray(nestedForm[key2]) || nestedForm[key2] instanceof File) {
        nestedForm[key2] = /* @__PURE__ */ Object.create(null);
      }
      nestedForm = nestedForm[key2];
    }
  });
};

// node_modules/hono/dist/utils/url.js
var splitPath = (path) => {
  const paths = path.split("/");
  if (paths[0] === "") {
    paths.shift();
  }
  return paths;
};
var splitRoutingPath = (routePath) => {
  const { groups, path } = extractGroupsFromPath(routePath);
  const paths = splitPath(path);
  return replaceGroupMarks(paths, groups);
};
var extractGroupsFromPath = (path) => {
  const groups = [];
  path = path.replace(/\{[^}]+\}/g, (match2, index) => {
    const mark = `@${index}`;
    groups.push([mark, match2]);
    return mark;
  });
  return { groups, path };
};
var replaceGroupMarks = (paths, groups) => {
  for (let i = groups.length - 1; i >= 0; i--) {
    const [mark] = groups[i];
    for (let j = paths.length - 1; j >= 0; j--) {
      if (paths[j].includes(mark)) {
        paths[j] = paths[j].replace(mark, groups[i][1]);
        break;
      }
    }
  }
  return paths;
};
var patternCache = {};
var getPattern = (label, next) => {
  if (label === "*") {
    return "*";
  }
  const match2 = label.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
  if (match2) {
    const cacheKey = `${label}#${next}`;
    if (!patternCache[cacheKey]) {
      if (match2[2]) {
        patternCache[cacheKey] = next && next[0] !== ":" && next[0] !== "*" ? [cacheKey, match2[1], new RegExp(`^${match2[2]}(?=/${next})`)] : [label, match2[1], new RegExp(`^${match2[2]}$`)];
      } else {
        patternCache[cacheKey] = [label, match2[1], true];
      }
    }
    return patternCache[cacheKey];
  }
  return null;
};
var tryDecode = (str, decoder) => {
  try {
    return decoder(str);
  } catch {
    return str.replace(/(?:%[0-9A-Fa-f]{2})+/g, (match2) => {
      try {
        return decoder(match2);
      } catch {
        return match2;
      }
    });
  }
};
var tryDecodeURI = (str) => tryDecode(str, decodeURI);
var getPath = (request) => {
  const url = request.url;
  const start = url.indexOf("/", url.indexOf(":") + 4);
  let i = start;
  for (; i < url.length; i++) {
    const charCode = url.charCodeAt(i);
    if (charCode === 37) {
      const queryIndex = url.indexOf("?", i);
      const hashIndex = url.indexOf("#", i);
      const end = queryIndex === -1 ? hashIndex === -1 ? void 0 : hashIndex : hashIndex === -1 ? queryIndex : Math.min(queryIndex, hashIndex);
      const path = url.slice(start, end);
      return tryDecodeURI(path.includes("%25") ? path.replace(/%25/g, "%2525") : path);
    } else if (charCode === 63 || charCode === 35) {
      break;
    }
  }
  return url.slice(start, i);
};
var getPathNoStrict = (request) => {
  const result = getPath(request);
  return result.length > 1 && result.at(-1) === "/" ? result.slice(0, -1) : result;
};
var mergePath = (base, sub, ...rest) => {
  if (rest.length) {
    sub = mergePath(sub, ...rest);
  }
  return `${base?.[0] === "/" ? "" : "/"}${base}${sub === "/" ? "" : `${base?.at(-1) === "/" ? "" : "/"}${sub?.[0] === "/" ? sub.slice(1) : sub}`}`;
};
var checkOptionalParameter = (path) => {
  if (path.charCodeAt(path.length - 1) !== 63 || !path.includes(":")) {
    return null;
  }
  const segments = path.split("/");
  const results = [];
  let basePath = "";
  segments.forEach((segment) => {
    if (segment !== "" && !/\:/.test(segment)) {
      basePath += "/" + segment;
    } else if (/\:/.test(segment)) {
      if (/\?/.test(segment)) {
        if (results.length === 0 && basePath === "") {
          results.push("/");
        } else {
          results.push(basePath);
        }
        const optionalSegment = segment.replace("?", "");
        basePath += "/" + optionalSegment;
        results.push(basePath);
      } else {
        basePath += "/" + segment;
      }
    }
  });
  return results.filter((v, i, a) => a.indexOf(v) === i);
};
var _decodeURI = (value) => {
  if (!/[%+]/.test(value)) {
    return value;
  }
  if (value.indexOf("+") !== -1) {
    value = value.replace(/\+/g, " ");
  }
  return value.indexOf("%") !== -1 ? tryDecode(value, decodeURIComponent_) : value;
};
var _getQueryParam = (url, key, multiple) => {
  let encoded;
  if (!multiple && key && !/[%+]/.test(key)) {
    let keyIndex2 = url.indexOf("?", 8);
    if (keyIndex2 === -1) {
      return void 0;
    }
    if (!url.startsWith(key, keyIndex2 + 1)) {
      keyIndex2 = url.indexOf(`&${key}`, keyIndex2 + 1);
    }
    while (keyIndex2 !== -1) {
      const trailingKeyCode = url.charCodeAt(keyIndex2 + key.length + 1);
      if (trailingKeyCode === 61) {
        const valueIndex = keyIndex2 + key.length + 2;
        const endIndex = url.indexOf("&", valueIndex);
        return _decodeURI(url.slice(valueIndex, endIndex === -1 ? void 0 : endIndex));
      } else if (trailingKeyCode == 38 || isNaN(trailingKeyCode)) {
        return "";
      }
      keyIndex2 = url.indexOf(`&${key}`, keyIndex2 + 1);
    }
    encoded = /[%+]/.test(url);
    if (!encoded) {
      return void 0;
    }
  }
  const results = {};
  encoded ??= /[%+]/.test(url);
  let keyIndex = url.indexOf("?", 8);
  while (keyIndex !== -1) {
    const nextKeyIndex = url.indexOf("&", keyIndex + 1);
    let valueIndex = url.indexOf("=", keyIndex);
    if (valueIndex > nextKeyIndex && nextKeyIndex !== -1) {
      valueIndex = -1;
    }
    let name = url.slice(
      keyIndex + 1,
      valueIndex === -1 ? nextKeyIndex === -1 ? void 0 : nextKeyIndex : valueIndex
    );
    if (encoded) {
      name = _decodeURI(name);
    }
    keyIndex = nextKeyIndex;
    if (name === "") {
      continue;
    }
    let value;
    if (valueIndex === -1) {
      value = "";
    } else {
      value = url.slice(valueIndex + 1, nextKeyIndex === -1 ? void 0 : nextKeyIndex);
      if (encoded) {
        value = _decodeURI(value);
      }
    }
    if (multiple) {
      if (!(results[name] && Array.isArray(results[name]))) {
        results[name] = [];
      }
      ;
      results[name].push(value);
    } else {
      results[name] ??= value;
    }
  }
  return key ? results[key] : results;
};
var getQueryParam = _getQueryParam;
var getQueryParams = (url, key) => {
  return _getQueryParam(url, key, true);
};
var decodeURIComponent_ = decodeURIComponent;

// node_modules/hono/dist/request.js
var tryDecodeURIComponent = (str) => tryDecode(str, decodeURIComponent_);
var HonoRequest = class {
  /**
   * `.raw` can get the raw Request object.
   *
   * @see {@link https://hono.dev/docs/api/request#raw}
   *
   * @example
   * ```ts
   * // For Cloudflare Workers
   * app.post('/', async (c) => {
   *   const metadata = c.req.raw.cf?.hostMetadata?
   *   ...
   * })
   * ```
   */
  raw;
  #validatedData;
  // Short name of validatedData
  #matchResult;
  routeIndex = 0;
  /**
   * `.path` can get the pathname of the request.
   *
   * @see {@link https://hono.dev/docs/api/request#path}
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const pathname = c.req.path // `/about/me`
   * })
   * ```
   */
  path;
  bodyCache = {};
  constructor(request, path = "/", matchResult = [[]]) {
    this.raw = request;
    this.path = path;
    this.#matchResult = matchResult;
    this.#validatedData = {};
  }
  param(key) {
    return key ? this.#getDecodedParam(key) : this.#getAllDecodedParams();
  }
  #getDecodedParam(key) {
    const paramKey = this.#matchResult[0][this.routeIndex][1][key];
    const param = this.#getParamValue(paramKey);
    return param && /\%/.test(param) ? tryDecodeURIComponent(param) : param;
  }
  #getAllDecodedParams() {
    const decoded = {};
    const keys = Object.keys(this.#matchResult[0][this.routeIndex][1]);
    for (const key of keys) {
      const value = this.#getParamValue(this.#matchResult[0][this.routeIndex][1][key]);
      if (value !== void 0) {
        decoded[key] = /\%/.test(value) ? tryDecodeURIComponent(value) : value;
      }
    }
    return decoded;
  }
  #getParamValue(paramKey) {
    return this.#matchResult[1] ? this.#matchResult[1][paramKey] : paramKey;
  }
  query(key) {
    return getQueryParam(this.url, key);
  }
  queries(key) {
    return getQueryParams(this.url, key);
  }
  header(name) {
    if (name) {
      return this.raw.headers.get(name) ?? void 0;
    }
    const headerData = {};
    this.raw.headers.forEach((value, key) => {
      headerData[key] = value;
    });
    return headerData;
  }
  async parseBody(options) {
    return parseBody(this, options);
  }
  #cachedBody = (key) => {
    const { bodyCache, raw: raw2 } = this;
    const cachedBody = bodyCache[key];
    if (cachedBody) {
      return cachedBody;
    }
    const anyCachedKey = Object.keys(bodyCache)[0];
    if (anyCachedKey) {
      return bodyCache[anyCachedKey].then((body) => {
        if (anyCachedKey === "json") {
          body = JSON.stringify(body);
        }
        return new Response(body)[key]();
      });
    }
    return bodyCache[key] = raw2[key]();
  };
  /**
   * `.json()` can parse Request body of type `application/json`
   *
   * @see {@link https://hono.dev/docs/api/request#json}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.json()
   * })
   * ```
   */
  json() {
    return this.#cachedBody("text").then((text) => JSON.parse(text));
  }
  /**
   * `.text()` can parse Request body of type `text/plain`
   *
   * @see {@link https://hono.dev/docs/api/request#text}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.text()
   * })
   * ```
   */
  text() {
    return this.#cachedBody("text");
  }
  /**
   * `.arrayBuffer()` parse Request body as an `ArrayBuffer`
   *
   * @see {@link https://hono.dev/docs/api/request#arraybuffer}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.arrayBuffer()
   * })
   * ```
   */
  arrayBuffer() {
    return this.#cachedBody("arrayBuffer");
  }
  /**
   * `.bytes()` parses the request body as a `Uint8Array`.
   *
   * @see {@link https://hono.dev/docs/api/request#bytes}
   *
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.bytes()
   * })
   * ```
   */
  bytes() {
    return this.#cachedBody("arrayBuffer").then((buffer) => new Uint8Array(buffer));
  }
  /**
   * Parses the request body as a `Blob`.
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.blob();
   * });
   * ```
   * @see https://hono.dev/docs/api/request#blob
   */
  blob() {
    return this.#cachedBody("blob");
  }
  /**
   * Parses the request body as `FormData`.
   * @example
   * ```ts
   * app.post('/entry', async (c) => {
   *   const body = await c.req.formData();
   * });
   * ```
   * @see https://hono.dev/docs/api/request#formdata
   */
  formData() {
    return this.#cachedBody("formData");
  }
  /**
   * Adds validated data to the request.
   *
   * @param target - The target of the validation.
   * @param data - The validated data to add.
   */
  addValidatedData(target, data) {
    this.#validatedData[target] = data;
  }
  valid(target) {
    return this.#validatedData[target];
  }
  /**
   * `.url()` can get the request url strings.
   *
   * @see {@link https://hono.dev/docs/api/request#url}
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const url = c.req.url // `http://localhost:8787/about/me`
   *   ...
   * })
   * ```
   */
  get url() {
    return this.raw.url;
  }
  /**
   * `.method()` can get the method name of the request.
   *
   * @see {@link https://hono.dev/docs/api/request#method}
   *
   * @example
   * ```ts
   * app.get('/about/me', (c) => {
   *   const method = c.req.method // `GET`
   * })
   * ```
   */
  get method() {
    return this.raw.method;
  }
  get [GET_MATCH_RESULT]() {
    return this.#matchResult;
  }
  /**
   * `.matchedRoutes()` can return a matched route in the handler
   *
   * @deprecated
   *
   * Use matchedRoutes helper defined in "hono/route" instead.
   *
   * @see {@link https://hono.dev/docs/api/request#matchedroutes}
   *
   * @example
   * ```ts
   * app.use('*', async function logger(c, next) {
   *   await next()
   *   c.req.matchedRoutes.forEach(({ handler, method, path }, i) => {
   *     const name = handler.name || (handler.length < 2 ? '[handler]' : '[middleware]')
   *     console.log(
   *       method,
   *       ' ',
   *       path,
   *       ' '.repeat(Math.max(10 - path.length, 0)),
   *       name,
   *       i === c.req.routeIndex ? '<- respond from here' : ''
   *     )
   *   })
   * })
   * ```
   */
  get matchedRoutes() {
    return this.#matchResult[0].map(([[, route]]) => route);
  }
  /**
   * `routePath()` can retrieve the path registered within the handler
   *
   * @deprecated
   *
   * Use routePath helper defined in "hono/route" instead.
   *
   * @see {@link https://hono.dev/docs/api/request#routepath}
   *
   * @example
   * ```ts
   * app.get('/posts/:id', (c) => {
   *   return c.json({ path: c.req.routePath })
   * })
   * ```
   */
  get routePath() {
    return this.#matchResult[0].map(([[, route]]) => route)[this.routeIndex].path;
  }
};

// node_modules/hono/dist/utils/html.js
var HtmlEscapedCallbackPhase = {
  Stringify: 1,
  BeforeStream: 2,
  Stream: 3
};
var raw = (value, callbacks) => {
  const escapedString = new String(value);
  escapedString.isEscaped = true;
  escapedString.callbacks = callbacks;
  return escapedString;
};
var resolveCallback = async (str, phase, preserveCallbacks, context, buffer) => {
  if (typeof str === "object" && !(str instanceof String)) {
    if (!(str instanceof Promise)) {
      str = str.toString();
    }
    if (str instanceof Promise) {
      str = await str;
    }
  }
  const callbacks = str.callbacks;
  if (!callbacks?.length) {
    return Promise.resolve(str);
  }
  if (buffer) {
    buffer[0] += str;
  } else {
    buffer = [str];
  }
  const resStr = Promise.all(callbacks.map((c) => c({ phase, buffer, context }))).then(
    (res) => Promise.all(
      res.filter(Boolean).map((str2) => resolveCallback(str2, phase, false, context, buffer))
    ).then(() => buffer[0])
  );
  if (preserveCallbacks) {
    return raw(await resStr, callbacks);
  } else {
    return resStr;
  }
};

// node_modules/hono/dist/context.js
var TEXT_PLAIN = "text/plain; charset=UTF-8";
var setDefaultContentType = (contentType, headers) => {
  return {
    "Content-Type": contentType,
    ...headers
  };
};
var createResponseInstance = (body, init) => new Response(body, init);
var Context = class {
  #rawRequest;
  #req;
  /**
   * `.env` can get bindings (environment variables, secrets, KV namespaces, D1 database, R2 bucket etc.) in Cloudflare Workers.
   *
   * @see {@link https://hono.dev/docs/api/context#env}
   *
   * @example
   * ```ts
   * // Environment object for Cloudflare Workers
   * app.get('*', async c => {
   *   const counter = c.env.COUNTER
   * })
   * ```
   */
  env = {};
  #var;
  finalized = false;
  /**
   * `.error` can get the error object from the middleware if the Handler throws an error.
   *
   * @see {@link https://hono.dev/docs/api/context#error}
   *
   * @example
   * ```ts
   * app.use('*', async (c, next) => {
   *   await next()
   *   if (c.error) {
   *     // do something...
   *   }
   * })
   * ```
   */
  error;
  #status;
  #executionCtx;
  #res;
  #layout;
  #renderer;
  #notFoundHandler;
  #preparedHeaders;
  #matchResult;
  #path;
  /**
   * Creates an instance of the Context class.
   *
   * @param req - The Request object.
   * @param options - Optional configuration options for the context.
   */
  constructor(req, options) {
    this.#rawRequest = req;
    if (options) {
      this.#executionCtx = options.executionCtx;
      this.env = options.env;
      this.#notFoundHandler = options.notFoundHandler;
      this.#path = options.path;
      this.#matchResult = options.matchResult;
    }
  }
  /**
   * `.req` is the instance of {@link HonoRequest}.
   */
  get req() {
    this.#req ??= new HonoRequest(this.#rawRequest, this.#path, this.#matchResult);
    return this.#req;
  }
  /**
   * @see {@link https://hono.dev/docs/api/context#event}
   * The FetchEvent associated with the current request.
   *
   * @throws Will throw an error if the context does not have a FetchEvent.
   */
  get event() {
    if (this.#executionCtx && "respondWith" in this.#executionCtx) {
      return this.#executionCtx;
    } else {
      throw Error("This context has no FetchEvent");
    }
  }
  /**
   * @see {@link https://hono.dev/docs/api/context#executionctx}
   * The ExecutionContext associated with the current request.
   *
   * @throws Will throw an error if the context does not have an ExecutionContext.
   */
  get executionCtx() {
    if (this.#executionCtx) {
      return this.#executionCtx;
    } else {
      throw Error("This context has no ExecutionContext");
    }
  }
  /**
   * @see {@link https://hono.dev/docs/api/context#res}
   * The Response object for the current request.
   */
  get res() {
    return this.#res ||= createResponseInstance(null, {
      headers: this.#preparedHeaders ??= new Headers()
    });
  }
  /**
   * Sets the Response object for the current request.
   *
   * @param _res - The Response object to set.
   */
  set res(_res) {
    if (this.#res && _res) {
      _res = createResponseInstance(_res.body, _res);
      for (const [k, v] of this.#res.headers.entries()) {
        if (k === "content-type") {
          continue;
        }
        if (k === "set-cookie") {
          const cookies = this.#res.headers.getSetCookie();
          _res.headers.delete("set-cookie");
          for (const cookie of cookies) {
            _res.headers.append("set-cookie", cookie);
          }
        } else {
          _res.headers.set(k, v);
        }
      }
    }
    this.#res = _res;
    this.finalized = true;
  }
  /**
   * `.render()` can create a response within a layout.
   *
   * @see {@link https://hono.dev/docs/api/context#render-setrenderer}
   *
   * @example
   * ```ts
   * app.get('/', (c) => {
   *   return c.render('Hello!')
   * })
   * ```
   */
  render = (...args) => {
    this.#renderer ??= (content) => this.html(content);
    return this.#renderer(...args);
  };
  /**
   * Sets the layout for the response.
   *
   * @param layout - The layout to set.
   * @returns The layout function.
   */
  setLayout = (layout) => this.#layout = layout;
  /**
   * Gets the current layout for the response.
   *
   * @returns The current layout function.
   */
  getLayout = () => this.#layout;
  /**
   * `.setRenderer()` can set the layout in the custom middleware.
   *
   * @see {@link https://hono.dev/docs/api/context#render-setrenderer}
   *
   * @example
   * ```tsx
   * app.use('*', async (c, next) => {
   *   c.setRenderer((content) => {
   *     return c.html(
   *       <html>
   *         <body>
   *           <p>{content}</p>
   *         </body>
   *       </html>
   *     )
   *   })
   *   await next()
   * })
   * ```
   */
  setRenderer = (renderer) => {
    this.#renderer = renderer;
  };
  /**
   * `.header()` can set headers.
   *
   * @see {@link https://hono.dev/docs/api/context#header}
   *
   * @example
   * ```ts
   * app.get('/welcome', (c) => {
   *   // Set headers
   *   c.header('X-Message', 'Hello!')
   *   c.header('Content-Type', 'text/plain')
   *
   *   return c.body('Thank you for coming')
   * })
   * ```
   */
  header = (name, value, options) => {
    if (this.finalized) {
      this.#res = createResponseInstance(this.#res.body, this.#res);
    }
    const headers = this.#res ? this.#res.headers : this.#preparedHeaders ??= new Headers();
    if (value === void 0) {
      headers.delete(name);
    } else if (options?.append) {
      headers.append(name, value);
    } else {
      headers.set(name, value);
    }
  };
  status = (status) => {
    this.#status = status;
  };
  /**
   * `.set()` can set the value specified by the key.
   *
   * @see {@link https://hono.dev/docs/api/context#set-get}
   *
   * @example
   * ```ts
   * app.use('*', async (c, next) => {
   *   c.set('message', 'Hono is hot!!')
   *   await next()
   * })
   * ```
   */
  set = (key, value) => {
    this.#var ??= /* @__PURE__ */ new Map();
    this.#var.set(key, value);
  };
  /**
   * `.get()` can use the value specified by the key.
   *
   * @see {@link https://hono.dev/docs/api/context#set-get}
   *
   * @example
   * ```ts
   * app.get('/', (c) => {
   *   const message = c.get('message')
   *   return c.text(`The message is "${message}"`)
   * })
   * ```
   */
  get = (key) => {
    return this.#var ? this.#var.get(key) : void 0;
  };
  /**
   * `.var` can access the value of a variable.
   *
   * @see {@link https://hono.dev/docs/api/context#var}
   *
   * @example
   * ```ts
   * const result = c.var.client.oneMethod()
   * ```
   */
  // c.var.propName is a read-only
  get var() {
    if (!this.#var) {
      return {};
    }
    return Object.fromEntries(this.#var);
  }
  #newResponse(data, arg, headers) {
    const responseHeaders = this.#res ? new Headers(this.#res.headers) : this.#preparedHeaders ?? new Headers();
    if (typeof arg === "object" && "headers" in arg) {
      const argHeaders = arg.headers instanceof Headers ? arg.headers : new Headers(arg.headers);
      for (const [key, value] of argHeaders) {
        if (key.toLowerCase() === "set-cookie") {
          responseHeaders.append(key, value);
        } else {
          responseHeaders.set(key, value);
        }
      }
    }
    if (headers) {
      for (const [k, v] of Object.entries(headers)) {
        if (typeof v === "string") {
          responseHeaders.set(k, v);
        } else {
          responseHeaders.delete(k);
          for (const v2 of v) {
            responseHeaders.append(k, v2);
          }
        }
      }
    }
    const status = typeof arg === "number" ? arg : arg?.status ?? this.#status;
    return createResponseInstance(data, { status, headers: responseHeaders });
  }
  newResponse = (...args) => this.#newResponse(...args);
  /**
   * `.body()` can return the HTTP response.
   * You can set headers with `.header()` and set HTTP status code with `.status`.
   * This can also be set in `.text()`, `.json()` and so on.
   *
   * @see {@link https://hono.dev/docs/api/context#body}
   *
   * @example
   * ```ts
   * app.get('/welcome', (c) => {
   *   // Set headers
   *   c.header('X-Message', 'Hello!')
   *   c.header('Content-Type', 'text/plain')
   *   // Set HTTP status code
   *   c.status(201)
   *
   *   // Return the response body
   *   return c.body('Thank you for coming')
   * })
   * ```
   */
  body = (data, arg, headers) => this.#newResponse(data, arg, headers);
  /**
   * `.text()` can render text as `Content-Type:text/plain`.
   *
   * @see {@link https://hono.dev/docs/api/context#text}
   *
   * @example
   * ```ts
   * app.get('/say', (c) => {
   *   return c.text('Hello!')
   * })
   * ```
   */
  text = (text, arg, headers) => {
    return !this.#preparedHeaders && !this.#status && !arg && !headers && !this.finalized ? new Response(text) : this.#newResponse(
      text,
      arg,
      setDefaultContentType(TEXT_PLAIN, headers)
    );
  };
  /**
   * `.json()` can render JSON as `Content-Type:application/json`.
   *
   * @see {@link https://hono.dev/docs/api/context#json}
   *
   * @example
   * ```ts
   * app.get('/api', (c) => {
   *   return c.json({ message: 'Hello!' })
   * })
   * ```
   */
  json = (object, arg, headers) => {
    return this.#newResponse(
      JSON.stringify(object),
      arg,
      setDefaultContentType("application/json", headers)
    );
  };
  html = (html, arg, headers) => {
    const res = (html2) => this.#newResponse(html2, arg, setDefaultContentType("text/html; charset=UTF-8", headers));
    return typeof html === "object" ? resolveCallback(html, HtmlEscapedCallbackPhase.Stringify, false, {}).then(res) : res(html);
  };
  /**
   * `.redirect()` can Redirect, default status code is 302.
   *
   * @see {@link https://hono.dev/docs/api/context#redirect}
   *
   * @example
   * ```ts
   * app.get('/redirect', (c) => {
   *   return c.redirect('/')
   * })
   * app.get('/redirect-permanently', (c) => {
   *   return c.redirect('/', 301)
   * })
   * ```
   */
  redirect = (location, status) => {
    const locationString = String(location);
    this.header(
      "Location",
      // Multibyes should be encoded
      // eslint-disable-next-line no-control-regex
      !/[^\x00-\xFF]/.test(locationString) ? locationString : encodeURI(locationString)
    );
    return this.newResponse(null, status ?? 302);
  };
  /**
   * `.notFound()` can return the Not Found Response.
   *
   * @see {@link https://hono.dev/docs/api/context#notfound}
   *
   * @example
   * ```ts
   * app.get('/notfound', (c) => {
   *   return c.notFound()
   * })
   * ```
   */
  notFound = () => {
    this.#notFoundHandler ??= () => createResponseInstance();
    return this.#notFoundHandler(this);
  };
};

// node_modules/hono/dist/router.js
var METHOD_NAME_ALL = "ALL";
var METHOD_NAME_ALL_LOWERCASE = "all";
var METHODS = ["get", "post", "put", "delete", "options", "patch"];
var MESSAGE_MATCHER_IS_ALREADY_BUILT = "Can not add a route since the matcher is already built.";
var UnsupportedPathError = class extends Error {
};

// node_modules/hono/dist/utils/constants.js
var COMPOSED_HANDLER = "__COMPOSED_HANDLER";

// node_modules/hono/dist/hono-base.js
var notFoundHandler = (c) => {
  return c.text("404 Not Found", 404);
};
var errorHandler = (err, c) => {
  if ("getResponse" in err) {
    const res = err.getResponse();
    return c.newResponse(res.body, res);
  }
  console.error(err);
  return c.text("Internal Server Error", 500);
};
var Hono = class _Hono {
  get;
  post;
  put;
  delete;
  options;
  patch;
  all;
  on;
  use;
  /*
    This class is like an abstract class and does not have a router.
    To use it, inherit the class and implement router in the constructor.
  */
  router;
  getPath;
  // Cannot use `#` because it requires visibility at JavaScript runtime.
  _basePath = "/";
  #path = "/";
  routes = [];
  constructor(options = {}) {
    const allMethods = [...METHODS, METHOD_NAME_ALL_LOWERCASE];
    allMethods.forEach((method) => {
      this[method] = (args1, ...args) => {
        if (typeof args1 === "string") {
          this.#path = args1;
        } else {
          this.#addRoute(method, this.#path, args1);
        }
        args.forEach((handler) => {
          this.#addRoute(method, this.#path, handler);
        });
        return this;
      };
    });
    this.on = (method, path, ...handlers) => {
      for (const p of [path].flat()) {
        this.#path = p;
        for (const m of [method].flat()) {
          handlers.map((handler) => {
            this.#addRoute(m.toUpperCase(), this.#path, handler);
          });
        }
      }
      return this;
    };
    this.use = (arg1, ...handlers) => {
      if (typeof arg1 === "string") {
        this.#path = arg1;
      } else {
        this.#path = "*";
        handlers.unshift(arg1);
      }
      handlers.forEach((handler) => {
        this.#addRoute(METHOD_NAME_ALL, this.#path, handler);
      });
      return this;
    };
    const { strict, ...optionsWithoutStrict } = options;
    Object.assign(this, optionsWithoutStrict);
    this.getPath = strict ?? true ? options.getPath ?? getPath : getPathNoStrict;
  }
  #clone() {
    const clone = new _Hono({
      router: this.router,
      getPath: this.getPath
    });
    clone.errorHandler = this.errorHandler;
    clone.#notFoundHandler = this.#notFoundHandler;
    clone.routes = this.routes;
    return clone;
  }
  #notFoundHandler = notFoundHandler;
  // Cannot use `#` because it requires visibility at JavaScript runtime.
  errorHandler = errorHandler;
  /**
   * `.route()` allows grouping other Hono instance in routes.
   *
   * @see {@link https://hono.dev/docs/api/routing#grouping}
   *
   * @param {string} path - base Path
   * @param {Hono} app - other Hono instance
   * @returns {Hono} routed Hono instance
   *
   * @example
   * ```ts
   * const app = new Hono()
   * const app2 = new Hono()
   *
   * app2.get("/user", (c) => c.text("user"))
   * app.route("/api", app2) // GET /api/user
   * ```
   */
  route(path, app2) {
    const subApp = this.basePath(path);
    app2.routes.map((r) => {
      let handler;
      if (app2.errorHandler === errorHandler) {
        handler = r.handler;
      } else {
        handler = async (c, next) => (await compose([], app2.errorHandler)(c, () => r.handler(c, next))).res;
        handler[COMPOSED_HANDLER] = r.handler;
      }
      subApp.#addRoute(r.method, r.path, handler, r.basePath);
    });
    return this;
  }
  /**
   * `.basePath()` allows base paths to be specified.
   *
   * @see {@link https://hono.dev/docs/api/routing#base-path}
   *
   * @param {string} path - base Path
   * @returns {Hono} changed Hono instance
   *
   * @example
   * ```ts
   * const api = new Hono().basePath('/api')
   * ```
   */
  basePath(path) {
    const subApp = this.#clone();
    subApp._basePath = mergePath(this._basePath, path);
    return subApp;
  }
  /**
   * `.onError()` handles an error and returns a customized Response.
   *
   * @see {@link https://hono.dev/docs/api/hono#error-handling}
   *
   * @param {ErrorHandler} handler - request Handler for error
   * @returns {Hono} changed Hono instance
   *
   * @example
   * ```ts
   * app.onError((err, c) => {
   *   console.error(`${err}`)
   *   return c.text('Custom Error Message', 500)
   * })
   * ```
   */
  onError = (handler) => {
    this.errorHandler = handler;
    return this;
  };
  /**
   * `.notFound()` allows you to customize a Not Found Response.
   *
   * @see {@link https://hono.dev/docs/api/hono#not-found}
   *
   * @param {NotFoundHandler} handler - request handler for not-found
   * @returns {Hono} changed Hono instance
   *
   * @example
   * ```ts
   * app.notFound((c) => {
   *   return c.text('Custom 404 Message', 404)
   * })
   * ```
   */
  notFound = (handler) => {
    this.#notFoundHandler = handler;
    return this;
  };
  /**
   * `.mount()` allows you to mount applications built with other frameworks into your Hono application.
   *
   * @see {@link https://hono.dev/docs/api/hono#mount}
   *
   * @param {string} path - base Path
   * @param {Function} applicationHandler - other Request Handler
   * @param {MountOptions} [options] - options of `.mount()`
   * @returns {Hono} mounted Hono instance
   *
   * @example
   * ```ts
   * import { Router as IttyRouter } from 'itty-router'
   * import { Hono } from 'hono'
   * // Create itty-router application
   * const ittyRouter = IttyRouter()
   * // GET /itty-router/hello
   * ittyRouter.get('/hello', () => new Response('Hello from itty-router'))
   *
   * const app = new Hono()
   * app.mount('/itty-router', ittyRouter.handle)
   * ```
   *
   * @example
   * ```ts
   * const app = new Hono()
   * // Send the request to another application without modification.
   * app.mount('/app', anotherApp, {
   *   replaceRequest: (req) => req,
   * })
   * ```
   */
  mount(path, applicationHandler, options) {
    let replaceRequest;
    let optionHandler;
    if (options) {
      if (typeof options === "function") {
        optionHandler = options;
      } else {
        optionHandler = options.optionHandler;
        if (options.replaceRequest === false) {
          replaceRequest = (request) => request;
        } else {
          replaceRequest = options.replaceRequest;
        }
      }
    }
    const getOptions = optionHandler ? (c) => {
      const options2 = optionHandler(c);
      return Array.isArray(options2) ? options2 : [options2];
    } : (c) => {
      let executionContext = void 0;
      try {
        executionContext = c.executionCtx;
      } catch {
      }
      return [c.env, executionContext];
    };
    replaceRequest ||= (() => {
      const mergedPath = mergePath(this._basePath, path);
      const pathPrefixLength = mergedPath === "/" ? 0 : mergedPath.length;
      return (request) => {
        const url = new URL(request.url);
        url.pathname = this.getPath(request).slice(pathPrefixLength) || "/";
        return new Request(url, request);
      };
    })();
    const handler = async (c, next) => {
      const res = await applicationHandler(replaceRequest(c.req.raw), ...getOptions(c));
      if (res) {
        return res;
      }
      await next();
    };
    this.#addRoute(METHOD_NAME_ALL, mergePath(path, "*"), handler);
    return this;
  }
  #addRoute(method, path, handler, baseRoutePath) {
    method = method.toUpperCase();
    path = mergePath(this._basePath, path);
    const r = {
      basePath: baseRoutePath !== void 0 ? mergePath(this._basePath, baseRoutePath) : this._basePath,
      path,
      method,
      handler
    };
    this.router.add(method, path, [handler, r]);
    this.routes.push(r);
  }
  #handleError(err, c) {
    if (err instanceof Error) {
      return this.errorHandler(err, c);
    }
    throw err;
  }
  #dispatch(request, executionCtx, env, method) {
    if (method === "HEAD") {
      return (async () => new Response(null, await this.#dispatch(request, executionCtx, env, "GET")))();
    }
    const path = this.getPath(request, { env });
    const matchResult = this.router.match(method, path);
    const c = new Context(request, {
      path,
      matchResult,
      env,
      executionCtx,
      notFoundHandler: this.#notFoundHandler
    });
    if (matchResult[0].length === 1) {
      let res;
      try {
        res = matchResult[0][0][0][0](c, async () => {
          c.res = await this.#notFoundHandler(c);
        });
      } catch (err) {
        return this.#handleError(err, c);
      }
      return res instanceof Promise ? res.then(
        (resolved) => resolved || (c.finalized ? c.res : this.#notFoundHandler(c))
      ).catch((err) => this.#handleError(err, c)) : res ?? this.#notFoundHandler(c);
    }
    const composed = compose(matchResult[0], this.errorHandler, this.#notFoundHandler);
    return (async () => {
      try {
        const context = await composed(c);
        if (!context.finalized) {
          throw new Error(
            "Context is not finalized. Did you forget to return a Response object or `await next()`?"
          );
        }
        return context.res;
      } catch (err) {
        return this.#handleError(err, c);
      }
    })();
  }
  /**
   * `.fetch()` will be entry point of your app.
   *
   * @see {@link https://hono.dev/docs/api/hono#fetch}
   *
   * @param {Request} request - request Object of request
   * @param {Env} Env - env Object
   * @param {ExecutionContext} - context of execution
   * @returns {Response | Promise<Response>} response of request
   *
   */
  fetch = (request, ...rest) => {
    return this.#dispatch(request, rest[1], rest[0], request.method);
  };
  /**
   * `.request()` is a useful method for testing.
   * You can pass a URL or pathname to send a GET request.
   * app will return a Response object.
   * ```ts
   * test('GET /hello is ok', async () => {
   *   const res = await app.request('/hello')
   *   expect(res.status).toBe(200)
   * })
   * ```
   * @see https://hono.dev/docs/api/hono#request
   */
  request = (input, requestInit, Env, executionCtx) => {
    if (input instanceof Request) {
      return this.fetch(requestInit ? new Request(input, requestInit) : input, Env, executionCtx);
    }
    input = input.toString();
    return this.fetch(
      new Request(
        /^https?:\/\//.test(input) ? input : `http://localhost${mergePath("/", input)}`,
        requestInit
      ),
      Env,
      executionCtx
    );
  };
  /**
   * `.fire()` automatically adds a global fetch event listener.
   * This can be useful for environments that adhere to the Service Worker API, such as non-ES module Cloudflare Workers.
   * @deprecated
   * Use `fire` from `hono/service-worker` instead.
   * ```ts
   * import { Hono } from 'hono'
   * import { fire } from 'hono/service-worker'
   *
   * const app = new Hono()
   * // ...
   * fire(app)
   * ```
   * @see https://hono.dev/docs/api/hono#fire
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API
   * @see https://developers.cloudflare.com/workers/reference/migrate-to-module-workers/
   */
  fire = () => {
    addEventListener("fetch", (event) => {
      event.respondWith(this.#dispatch(event.request, event, void 0, event.request.method));
    });
  };
};

// node_modules/hono/dist/router/reg-exp-router/matcher.js
var emptyParam = [];
function match(method, path) {
  const matchers = this.buildAllMatchers();
  const match2 = ((method2, path2) => {
    const matcher = matchers[method2] || matchers[METHOD_NAME_ALL];
    const staticMatch = matcher[2][path2];
    if (staticMatch) {
      return staticMatch;
    }
    const match3 = path2.match(matcher[0]);
    if (!match3) {
      return [[], emptyParam];
    }
    const index = match3.indexOf("", 1);
    return [matcher[1][index], match3];
  });
  this.match = match2;
  return match2(method, path);
}

// node_modules/hono/dist/router/reg-exp-router/node.js
var LABEL_REG_EXP_STR = "[^/]+";
var ONLY_WILDCARD_REG_EXP_STR = ".*";
var TAIL_WILDCARD_REG_EXP_STR = "(?:|/.*)";
var PATH_ERROR = /* @__PURE__ */ Symbol();
var regExpMetaChars = new Set(".\\+*[^]$()");
function compareKey(a, b) {
  if (a.length === 1) {
    return b.length === 1 ? a < b ? -1 : 1 : -1;
  }
  if (b.length === 1) {
    return 1;
  }
  if (a === ONLY_WILDCARD_REG_EXP_STR || a === TAIL_WILDCARD_REG_EXP_STR) {
    return 1;
  } else if (b === ONLY_WILDCARD_REG_EXP_STR || b === TAIL_WILDCARD_REG_EXP_STR) {
    return -1;
  }
  if (a === LABEL_REG_EXP_STR) {
    return 1;
  } else if (b === LABEL_REG_EXP_STR) {
    return -1;
  }
  return a.length === b.length ? a < b ? -1 : 1 : b.length - a.length;
}
var Node = class _Node {
  #index;
  #varIndex;
  #children = /* @__PURE__ */ Object.create(null);
  insert(tokens, index, paramMap, context, pathErrorCheckOnly) {
    if (tokens.length === 0) {
      if (this.#index !== void 0) {
        throw PATH_ERROR;
      }
      if (pathErrorCheckOnly) {
        return;
      }
      this.#index = index;
      return;
    }
    const [token, ...restTokens] = tokens;
    const pattern = token === "*" ? restTokens.length === 0 ? ["", "", ONLY_WILDCARD_REG_EXP_STR] : ["", "", LABEL_REG_EXP_STR] : token === "/*" ? ["", "", TAIL_WILDCARD_REG_EXP_STR] : token.match(/^\:([^\{\}]+)(?:\{(.+)\})?$/);
    let node;
    if (pattern) {
      const name = pattern[1];
      let regexpStr = pattern[2] || LABEL_REG_EXP_STR;
      if (name && pattern[2]) {
        if (regexpStr === ".*") {
          throw PATH_ERROR;
        }
        regexpStr = regexpStr.replace(/^\((?!\?:)(?=[^)]+\)$)/, "(?:");
        if (/\((?!\?:)/.test(regexpStr)) {
          throw PATH_ERROR;
        }
      }
      node = this.#children[regexpStr];
      if (!node) {
        if (Object.keys(this.#children).some(
          (k) => k !== ONLY_WILDCARD_REG_EXP_STR && k !== TAIL_WILDCARD_REG_EXP_STR
        )) {
          throw PATH_ERROR;
        }
        if (pathErrorCheckOnly) {
          return;
        }
        node = this.#children[regexpStr] = new _Node();
        if (name !== "") {
          node.#varIndex = context.varIndex++;
        }
      }
      if (!pathErrorCheckOnly && name !== "") {
        paramMap.push([name, node.#varIndex]);
      }
    } else {
      node = this.#children[token];
      if (!node) {
        if (Object.keys(this.#children).some(
          (k) => k.length > 1 && k !== ONLY_WILDCARD_REG_EXP_STR && k !== TAIL_WILDCARD_REG_EXP_STR
        )) {
          throw PATH_ERROR;
        }
        if (pathErrorCheckOnly) {
          return;
        }
        node = this.#children[token] = new _Node();
      }
    }
    node.insert(restTokens, index, paramMap, context, pathErrorCheckOnly);
  }
  buildRegExpStr() {
    const childKeys = Object.keys(this.#children).sort(compareKey);
    const strList = childKeys.map((k) => {
      const c = this.#children[k];
      return (typeof c.#varIndex === "number" ? `(${k})@${c.#varIndex}` : regExpMetaChars.has(k) ? `\\${k}` : k) + c.buildRegExpStr();
    });
    if (typeof this.#index === "number") {
      strList.unshift(`#${this.#index}`);
    }
    if (strList.length === 0) {
      return "";
    }
    if (strList.length === 1) {
      return strList[0];
    }
    return "(?:" + strList.join("|") + ")";
  }
};

// node_modules/hono/dist/router/reg-exp-router/trie.js
var Trie = class {
  #context = { varIndex: 0 };
  #root = new Node();
  insert(path, index, pathErrorCheckOnly) {
    const paramAssoc = [];
    const groups = [];
    for (let i = 0; ; ) {
      let replaced = false;
      path = path.replace(/\{[^}]+\}/g, (m) => {
        const mark = `@\\${i}`;
        groups[i] = [mark, m];
        i++;
        replaced = true;
        return mark;
      });
      if (!replaced) {
        break;
      }
    }
    const tokens = path.match(/(?::[^\/]+)|(?:\/\*$)|./g) || [];
    for (let i = groups.length - 1; i >= 0; i--) {
      const [mark] = groups[i];
      for (let j = tokens.length - 1; j >= 0; j--) {
        if (tokens[j].indexOf(mark) !== -1) {
          tokens[j] = tokens[j].replace(mark, groups[i][1]);
          break;
        }
      }
    }
    this.#root.insert(tokens, index, paramAssoc, this.#context, pathErrorCheckOnly);
    return paramAssoc;
  }
  buildRegExp() {
    let regexp = this.#root.buildRegExpStr();
    if (regexp === "") {
      return [/^$/, [], []];
    }
    let captureIndex = 0;
    const indexReplacementMap = [];
    const paramReplacementMap = [];
    regexp = regexp.replace(/#(\d+)|@(\d+)|\.\*\$/g, (_, handlerIndex, paramIndex) => {
      if (handlerIndex !== void 0) {
        indexReplacementMap[++captureIndex] = Number(handlerIndex);
        return "$()";
      }
      if (paramIndex !== void 0) {
        paramReplacementMap[Number(paramIndex)] = ++captureIndex;
        return "";
      }
      return "";
    });
    return [new RegExp(`^${regexp}`), indexReplacementMap, paramReplacementMap];
  }
};

// node_modules/hono/dist/router/reg-exp-router/router.js
var nullMatcher = [/^$/, [], /* @__PURE__ */ Object.create(null)];
var wildcardRegExpCache = /* @__PURE__ */ Object.create(null);
function buildWildcardRegExp(path) {
  return wildcardRegExpCache[path] ??= new RegExp(
    path === "*" ? "" : `^${path.replace(
      /\/\*$|([.\\+*[^\]$()])/g,
      (_, metaChar) => metaChar ? `\\${metaChar}` : "(?:|/.*)"
    )}$`
  );
}
function clearWildcardRegExpCache() {
  wildcardRegExpCache = /* @__PURE__ */ Object.create(null);
}
function buildMatcherFromPreprocessedRoutes(routes) {
  const trie = new Trie();
  const handlerData = [];
  if (routes.length === 0) {
    return nullMatcher;
  }
  const routesWithStaticPathFlag = routes.map(
    (route) => [!/\*|\/:/.test(route[0]), ...route]
  ).sort(
    ([isStaticA, pathA], [isStaticB, pathB]) => isStaticA ? 1 : isStaticB ? -1 : pathA.length - pathB.length
  );
  const staticMap = /* @__PURE__ */ Object.create(null);
  for (let i = 0, j = -1, len = routesWithStaticPathFlag.length; i < len; i++) {
    const [pathErrorCheckOnly, path, handlers] = routesWithStaticPathFlag[i];
    if (pathErrorCheckOnly) {
      staticMap[path] = [handlers.map(([h]) => [h, /* @__PURE__ */ Object.create(null)]), emptyParam];
    } else {
      j++;
    }
    let paramAssoc;
    try {
      paramAssoc = trie.insert(path, j, pathErrorCheckOnly);
    } catch (e) {
      throw e === PATH_ERROR ? new UnsupportedPathError(path) : e;
    }
    if (pathErrorCheckOnly) {
      continue;
    }
    handlerData[j] = handlers.map(([h, paramCount]) => {
      const paramIndexMap = /* @__PURE__ */ Object.create(null);
      paramCount -= 1;
      for (; paramCount >= 0; paramCount--) {
        const [key, value] = paramAssoc[paramCount];
        paramIndexMap[key] = value;
      }
      return [h, paramIndexMap];
    });
  }
  const [regexp, indexReplacementMap, paramReplacementMap] = trie.buildRegExp();
  for (let i = 0, len = handlerData.length; i < len; i++) {
    for (let j = 0, len2 = handlerData[i].length; j < len2; j++) {
      const map = handlerData[i][j]?.[1];
      if (!map) {
        continue;
      }
      const keys = Object.keys(map);
      for (let k = 0, len3 = keys.length; k < len3; k++) {
        map[keys[k]] = paramReplacementMap[map[keys[k]]];
      }
    }
  }
  const handlerMap = [];
  for (const i in indexReplacementMap) {
    handlerMap[i] = handlerData[indexReplacementMap[i]];
  }
  return [regexp, handlerMap, staticMap];
}
function findMiddleware(middleware, path) {
  if (!middleware) {
    return void 0;
  }
  for (const k of Object.keys(middleware).sort((a, b) => b.length - a.length)) {
    if (buildWildcardRegExp(k).test(path)) {
      return [...middleware[k]];
    }
  }
  return void 0;
}
var RegExpRouter = class {
  name = "RegExpRouter";
  #middleware;
  #routes;
  constructor() {
    this.#middleware = { [METHOD_NAME_ALL]: /* @__PURE__ */ Object.create(null) };
    this.#routes = { [METHOD_NAME_ALL]: /* @__PURE__ */ Object.create(null) };
  }
  add(method, path, handler) {
    const middleware = this.#middleware;
    const routes = this.#routes;
    if (!middleware || !routes) {
      throw new Error(MESSAGE_MATCHER_IS_ALREADY_BUILT);
    }
    if (!middleware[method]) {
      ;
      [middleware, routes].forEach((handlerMap) => {
        handlerMap[method] = /* @__PURE__ */ Object.create(null);
        Object.keys(handlerMap[METHOD_NAME_ALL]).forEach((p) => {
          handlerMap[method][p] = [...handlerMap[METHOD_NAME_ALL][p]];
        });
      });
    }
    if (path === "/*") {
      path = "*";
    }
    const paramCount = (path.match(/\/:/g) || []).length;
    if (/\*$/.test(path)) {
      const re = buildWildcardRegExp(path);
      if (method === METHOD_NAME_ALL) {
        Object.keys(middleware).forEach((m) => {
          middleware[m][path] ||= findMiddleware(middleware[m], path) || findMiddleware(middleware[METHOD_NAME_ALL], path) || [];
        });
      } else {
        middleware[method][path] ||= findMiddleware(middleware[method], path) || findMiddleware(middleware[METHOD_NAME_ALL], path) || [];
      }
      Object.keys(middleware).forEach((m) => {
        if (method === METHOD_NAME_ALL || method === m) {
          Object.keys(middleware[m]).forEach((p) => {
            re.test(p) && middleware[m][p].push([handler, paramCount]);
          });
        }
      });
      Object.keys(routes).forEach((m) => {
        if (method === METHOD_NAME_ALL || method === m) {
          Object.keys(routes[m]).forEach(
            (p) => re.test(p) && routes[m][p].push([handler, paramCount])
          );
        }
      });
      return;
    }
    const paths = checkOptionalParameter(path) || [path];
    for (let i = 0, len = paths.length; i < len; i++) {
      const path2 = paths[i];
      Object.keys(routes).forEach((m) => {
        if (method === METHOD_NAME_ALL || method === m) {
          routes[m][path2] ||= [
            ...findMiddleware(middleware[m], path2) || findMiddleware(middleware[METHOD_NAME_ALL], path2) || []
          ];
          routes[m][path2].push([handler, paramCount - len + i + 1]);
        }
      });
    }
  }
  match = match;
  buildAllMatchers() {
    const matchers = /* @__PURE__ */ Object.create(null);
    Object.keys(this.#routes).concat(Object.keys(this.#middleware)).forEach((method) => {
      matchers[method] ||= this.#buildMatcher(method);
    });
    this.#middleware = this.#routes = void 0;
    clearWildcardRegExpCache();
    return matchers;
  }
  #buildMatcher(method) {
    const routes = [];
    let hasOwnRoute = method === METHOD_NAME_ALL;
    [this.#middleware, this.#routes].forEach((r) => {
      const ownRoute = r[method] ? Object.keys(r[method]).map((path) => [path, r[method][path]]) : [];
      if (ownRoute.length !== 0) {
        hasOwnRoute ||= true;
        routes.push(...ownRoute);
      } else if (method !== METHOD_NAME_ALL) {
        routes.push(
          ...Object.keys(r[METHOD_NAME_ALL]).map((path) => [path, r[METHOD_NAME_ALL][path]])
        );
      }
    });
    if (!hasOwnRoute) {
      return null;
    } else {
      return buildMatcherFromPreprocessedRoutes(routes);
    }
  }
};

// node_modules/hono/dist/router/smart-router/router.js
var SmartRouter = class {
  name = "SmartRouter";
  #routers = [];
  #routes = [];
  constructor(init) {
    this.#routers = init.routers;
  }
  add(method, path, handler) {
    if (!this.#routes) {
      throw new Error(MESSAGE_MATCHER_IS_ALREADY_BUILT);
    }
    this.#routes.push([method, path, handler]);
  }
  match(method, path) {
    if (!this.#routes) {
      throw new Error("Fatal error");
    }
    const routers = this.#routers;
    const routes = this.#routes;
    const len = routers.length;
    let i = 0;
    let res;
    for (; i < len; i++) {
      const router = routers[i];
      try {
        for (let i2 = 0, len2 = routes.length; i2 < len2; i2++) {
          router.add(...routes[i2]);
        }
        res = router.match(method, path);
      } catch (e) {
        if (e instanceof UnsupportedPathError) {
          continue;
        }
        throw e;
      }
      this.match = router.match.bind(router);
      this.#routers = [router];
      this.#routes = void 0;
      break;
    }
    if (i === len) {
      throw new Error("Fatal error");
    }
    this.name = `SmartRouter + ${this.activeRouter.name}`;
    return res;
  }
  get activeRouter() {
    if (this.#routes || this.#routers.length !== 1) {
      throw new Error("No active router has been determined yet.");
    }
    return this.#routers[0];
  }
};

// node_modules/hono/dist/router/trie-router/node.js
var emptyParams = /* @__PURE__ */ Object.create(null);
var hasChildren = (children) => {
  for (const _ in children) {
    return true;
  }
  return false;
};
var Node2 = class _Node2 {
  #methods;
  #children;
  #patterns;
  #order = 0;
  #params = emptyParams;
  constructor(method, handler, children) {
    this.#children = children || /* @__PURE__ */ Object.create(null);
    this.#methods = [];
    if (method && handler) {
      const m = /* @__PURE__ */ Object.create(null);
      m[method] = { handler, possibleKeys: [], score: 0 };
      this.#methods = [m];
    }
    this.#patterns = [];
  }
  insert(method, path, handler) {
    this.#order = ++this.#order;
    let curNode = this;
    const parts = splitRoutingPath(path);
    const possibleKeys = [];
    for (let i = 0, len = parts.length; i < len; i++) {
      const p = parts[i];
      const nextP = parts[i + 1];
      const pattern = getPattern(p, nextP);
      const key = Array.isArray(pattern) ? pattern[0] : p;
      if (key in curNode.#children) {
        curNode = curNode.#children[key];
        if (pattern) {
          possibleKeys.push(pattern[1]);
        }
        continue;
      }
      curNode.#children[key] = new _Node2();
      if (pattern) {
        curNode.#patterns.push(pattern);
        possibleKeys.push(pattern[1]);
      }
      curNode = curNode.#children[key];
    }
    curNode.#methods.push({
      [method]: {
        handler,
        possibleKeys: possibleKeys.filter((v, i, a) => a.indexOf(v) === i),
        score: this.#order
      }
    });
    return curNode;
  }
  #pushHandlerSets(handlerSets, node, method, nodeParams, params) {
    for (let i = 0, len = node.#methods.length; i < len; i++) {
      const m = node.#methods[i];
      const handlerSet = m[method] || m[METHOD_NAME_ALL];
      const processedSet = {};
      if (handlerSet !== void 0) {
        handlerSet.params = /* @__PURE__ */ Object.create(null);
        handlerSets.push(handlerSet);
        if (nodeParams !== emptyParams || params && params !== emptyParams) {
          for (let i2 = 0, len2 = handlerSet.possibleKeys.length; i2 < len2; i2++) {
            const key = handlerSet.possibleKeys[i2];
            const processed = processedSet[handlerSet.score];
            handlerSet.params[key] = params?.[key] && !processed ? params[key] : nodeParams[key] ?? params?.[key];
            processedSet[handlerSet.score] = true;
          }
        }
      }
    }
  }
  search(method, path) {
    const handlerSets = [];
    this.#params = emptyParams;
    const curNode = this;
    let curNodes = [curNode];
    const parts = splitPath(path);
    const curNodesQueue = [];
    const len = parts.length;
    let partOffsets = null;
    for (let i = 0; i < len; i++) {
      const part = parts[i];
      const isLast = i === len - 1;
      const tempNodes = [];
      for (let j = 0, len2 = curNodes.length; j < len2; j++) {
        const node = curNodes[j];
        const nextNode = node.#children[part];
        if (nextNode) {
          nextNode.#params = node.#params;
          if (isLast) {
            if (nextNode.#children["*"]) {
              this.#pushHandlerSets(handlerSets, nextNode.#children["*"], method, node.#params);
            }
            this.#pushHandlerSets(handlerSets, nextNode, method, node.#params);
          } else {
            tempNodes.push(nextNode);
          }
        }
        for (let k = 0, len3 = node.#patterns.length; k < len3; k++) {
          const pattern = node.#patterns[k];
          const params = node.#params === emptyParams ? {} : { ...node.#params };
          if (pattern === "*") {
            const astNode = node.#children["*"];
            if (astNode) {
              this.#pushHandlerSets(handlerSets, astNode, method, node.#params);
              astNode.#params = params;
              tempNodes.push(astNode);
            }
            continue;
          }
          const [key, name, matcher] = pattern;
          if (!part && !(matcher instanceof RegExp)) {
            continue;
          }
          const child = node.#children[key];
          if (matcher instanceof RegExp) {
            if (partOffsets === null) {
              partOffsets = new Array(len);
              let offset = path[0] === "/" ? 1 : 0;
              for (let p = 0; p < len; p++) {
                partOffsets[p] = offset;
                offset += parts[p].length + 1;
              }
            }
            const restPathString = path.substring(partOffsets[i]);
            const m = matcher.exec(restPathString);
            if (m) {
              params[name] = m[0];
              this.#pushHandlerSets(handlerSets, child, method, node.#params, params);
              if (hasChildren(child.#children)) {
                child.#params = params;
                const componentCount = m[0].match(/\//)?.length ?? 0;
                const targetCurNodes = curNodesQueue[componentCount] ||= [];
                targetCurNodes.push(child);
              }
              continue;
            }
          }
          if (matcher === true || matcher.test(part)) {
            params[name] = part;
            if (isLast) {
              this.#pushHandlerSets(handlerSets, child, method, params, node.#params);
              if (child.#children["*"]) {
                this.#pushHandlerSets(
                  handlerSets,
                  child.#children["*"],
                  method,
                  params,
                  node.#params
                );
              }
            } else {
              child.#params = params;
              tempNodes.push(child);
            }
          }
        }
      }
      const shifted = curNodesQueue.shift();
      curNodes = shifted ? tempNodes.concat(shifted) : tempNodes;
    }
    if (handlerSets.length > 1) {
      handlerSets.sort((a, b) => {
        return a.score - b.score;
      });
    }
    return [handlerSets.map(({ handler, params }) => [handler, params])];
  }
};

// node_modules/hono/dist/router/trie-router/router.js
var TrieRouter = class {
  name = "TrieRouter";
  #node;
  constructor() {
    this.#node = new Node2();
  }
  add(method, path, handler) {
    const results = checkOptionalParameter(path);
    if (results) {
      for (let i = 0, len = results.length; i < len; i++) {
        this.#node.insert(method, results[i], handler);
      }
      return;
    }
    this.#node.insert(method, path, handler);
  }
  match(method, path) {
    return this.#node.search(method, path);
  }
};

// node_modules/hono/dist/hono.js
var Hono2 = class extends Hono {
  /**
   * Creates an instance of the Hono class.
   *
   * @param options - Optional configuration options for the Hono instance.
   */
  constructor(options = {}) {
    super(options);
    this.router = options.router ?? new SmartRouter({
      routers: [new RegExpRouter(), new TrieRouter()]
    });
  }
};

// node_modules/hono/dist/middleware/cors/index.js
var cors = (options) => {
  const opts = {
    origin: "*",
    allowMethods: ["GET", "HEAD", "PUT", "POST", "DELETE", "PATCH"],
    allowHeaders: [],
    exposeHeaders: [],
    ...options
  };
  const findAllowOrigin = ((optsOrigin) => {
    if (typeof optsOrigin === "string") {
      if (optsOrigin === "*") {
        return () => optsOrigin;
      } else {
        return (origin) => optsOrigin === origin ? origin : null;
      }
    } else if (typeof optsOrigin === "function") {
      return optsOrigin;
    } else {
      return (origin) => optsOrigin.includes(origin) ? origin : null;
    }
  })(opts.origin);
  const findAllowMethods = ((optsAllowMethods) => {
    if (typeof optsAllowMethods === "function") {
      return optsAllowMethods;
    } else if (Array.isArray(optsAllowMethods)) {
      return () => optsAllowMethods;
    } else {
      return () => [];
    }
  })(opts.allowMethods);
  return async function cors2(c, next) {
    function set(key, value) {
      c.res.headers.set(key, value);
    }
    const allowOrigin = await findAllowOrigin(c.req.header("origin") || "", c);
    if (allowOrigin) {
      set("Access-Control-Allow-Origin", allowOrigin);
    }
    if (opts.credentials) {
      set("Access-Control-Allow-Credentials", "true");
    }
    if (opts.exposeHeaders?.length) {
      set("Access-Control-Expose-Headers", opts.exposeHeaders.join(","));
    }
    if (c.req.method === "OPTIONS") {
      if (opts.origin !== "*") {
        set("Vary", "Origin");
      }
      if (opts.maxAge != null) {
        set("Access-Control-Max-Age", opts.maxAge.toString());
      }
      const allowMethods = await findAllowMethods(c.req.header("origin") || "", c);
      if (allowMethods.length) {
        set("Access-Control-Allow-Methods", allowMethods.join(","));
      }
      let headers = opts.allowHeaders;
      if (!headers?.length) {
        const requestHeaders = c.req.header("Access-Control-Request-Headers");
        if (requestHeaders) {
          headers = requestHeaders.split(/\s*,\s*/);
        }
      }
      if (headers?.length) {
        set("Access-Control-Allow-Headers", headers.join(","));
        c.res.headers.append("Vary", "Access-Control-Request-Headers");
      }
      c.res.headers.delete("Content-Length");
      c.res.headers.delete("Content-Type");
      return new Response(null, {
        headers: c.res.headers,
        status: 204,
        statusText: "No Content"
      });
    }
    await next();
    if (opts.origin !== "*") {
      c.header("Vary", "Origin", { append: true });
    }
  };
};

// src/index.ts
var FEISHU_CONFIG = {
  appId: "cli_aace77019aba9cdb",
  appSecret: "ii2lYil9d5PXViTTjYlzaddB6YKuL25T",
  appToken: "NVh9bDiNRaF0ZysxjeLc5ID2n9c",
  // 招聘任务表：含招聘岗位、部门、城市、人数、紧急度、JD等具体需求数据
  requisitionTableId: "tblEiMBFXcvSspQd",
  // 年度招聘需求表：含岗位定义、薪资范围、能力维度等模板数据
  positionTableId: "tblnT0AHtiLsvMeB",
  // 人才库表：小七系统写入的已入库候选人数据
  talentTableId: "tblWkwsoTIPhzusI",
  // 审核人 open_id（AI分析后发卡片给谁）
  reviewerOpenId: "ou_7c59c0b6f4be0717cc9202aa261ae04a",
  // 招聘群 Chat ID（用于「提醒面试官」推送）
  recruitmentGroupChatId: "",
  // 面试官 open_id 映射（姓名 → open_id，用于提醒面试官）
  interviewerOpenIds: {
    "\u66FE\u9896": "ou_39a7046c231335fd28f0cedc61c30185",
    "\u675C\u96C1\u73B2": "ou_a6087857e92467972ad2070ca5219dca",
    "\u738B\u5F66\u5F3A": "ou_66f58c7b6db1e92d637d03ada32dc0d7",
    "\u5F90\u665F": "ou_54e99e9c884841558c968ee0bfda7c9c",
    "\u4F55\u96E8\u83F1": "ou_6ef1ac4432e825acd26c2a3bc7202fea",
    "\u77F3\u78CA": "ou_dbc15e29e3d189ac73440e1edb7c6625",
    "\u97E9\u60A6": "ou_4b554b16837fb118405d1b75397729e",
    "\u674E\u5174": "ou_5f8edce3b1180dda025ffcca2cad5e41",
    "\u738B\u90BA\u8F89": "ou_6f57a77b82a1bd53c845a66e27af3170",
    "\u4E25\u9E4F": "ou_ef906466a58b71dc3d6d27d7ce0f68cc",
    "\u9B4F\u51B0": "ou_3772f691a70f636db73173f6326f03b",
    "\u9EC4\u96C1": "ou_b41ffd621300271ce7241b8e2439f6a",
    "\u9B4F\u79CB\u67E0": "ou_35683c77de559475379929138391eac",
    "\u6797\u70FD": "ou_975ee740fe8c2e2ea0ce2f1db999bf5f",
    "\u4E30\u6587\u6770": "ou_c4589dc9d7d49793d14d93a636f85aa1",
    "\u80E1\u987A": "ou_1f014a0f2fa5f2889917435e1ec01381",
    "\u5F20\u7EE7\u9E4F": "ou_dc096d1c92efacac5d1cbcf550016e2b",
    "\u5F6D\u521B": "ou_00c40dbb8254f9db022c52b1a0868fe8",
    "\u9648\u5B87\u4F73": "ou_ebeb4c63d55ed4c9ac736dd3941e69f",
    "\u738B\u5609\u4F1F": "ou_f818646bc1578fcef79e7bdf24fed7b0",
    "\u5B97\u838E": "ou_0bacd6231d3eda000a86e070cc19674c",
    "\u8C2D\u7EF4": "ou_63b2097647cb67d74446219b69ef5d5",
    "\u6B27\u9633\u5251": "ou_2127d082f0c3517ae18989ed17b0fb1d",
    "\u5434\u601D\u4E3A": "ou_af4f671ef7f608a1d47035a386db8f7e",
    "\u674E\u535A": "ou_1622b65c8d2af2a302afed7983ba9e51",
    "\u674E\u53CC": "ou_38313f315accf8f1b38583242b04db2f",
    "\u8303\u91D1\u8363": "ou_b43dbc4416047f4808ad5655b6e49f09",
    "\u9EC4\u7EF4": "ou_a4289f67a7465b16a97db8d16987d6e3",
    "\u5E15\u5408\u5C14\u5C3C\u6C99\xB7\u963F\u4E0D\u91CC\u5B5C": "ou_60410a0f83db41fb936a6b76ee575cc1"
  },
  // 默认 HR open_id（作为面试官提醒的兜底）
  defaultHrOpenId: "ou_7c59c0b6f4be0717cc9202aa261ae04a",
  // Drive 目标文件夹 Token（上传简历用）
  driveFolderToken: ""
};
var BITABLE_CACHE_TTL = 3e4;
var bitableCache = /* @__PURE__ */ new Map();
var app = new Hono2();
app.use("*", cors());
async function hmacSha256(key, message) {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return crypto.subtle.sign("HMAC", cryptoKey, enc.encode(message));
}
function bufToB64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
function b64ToBuf(s) {
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
function b64url(s) {
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlBuf(buf) {
  return bufToB64(buf).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
async function createJwt(secretKey, email) {
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const exp = Math.floor(Date.now() / 1e3) + 30 * 24 * 60 * 60;
  const payload = b64url(JSON.stringify({ sub: email, exp }));
  const data = `${header}.${payload}`;
  const sig = await hmacSha256(secretKey, data);
  return `${data}.${b64urlBuf(sig)}`;
}
async function verifyJwt(secretKey, token) {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [header, payload, sig] = parts;
  const data = `${header}.${payload}`;
  const expectedSig = b64urlBuf(await hmacSha256(secretKey, data));
  if (sig !== expectedSig) return null;
  try {
    const decoded = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const obj = JSON.parse(decoded);
    if (obj.exp && obj.exp < Math.floor(Date.now() / 1e3)) return null;
    return obj;
  } catch {
    return null;
  }
}
async function hashPassword(secretKey, password) {
  return bufToB64(await hmacSha256(secretKey, password));
}
async function verifyPassword(secretKey, password, hash) {
  const computed = await hashPassword(secretKey, password);
  return computed === hash;
}
async function getCustomPrompt(env, key) {
  try {
    const row = await env.DB.prepare(
      "SELECT prompt_configs FROM system_configs ORDER BY updated_at DESC LIMIT 1"
    ).first();
    if (!row?.prompt_configs) return null;
    const configs = JSON.parse(row.prompt_configs);
    const prompts = configs.prompts || configs;
    return prompts[key] || null;
  } catch {
    return null;
  }
}
async function callAI(env, systemPrompt, userPrompt, model) {
  if (env.AI_API_KEY) {
    const baseUrl = (env.AI_BASE_URL || "https://api.deepseek.com").replace(/\/+$/, "");
    const deepseekModel = model === "deepseek-v4-flash" ? "deepseek-chat" : model || "deepseek-chat";
    const resp = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${env.AI_API_KEY}`
      },
      body: JSON.stringify({
        model: deepseekModel,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        max_tokens: 4096
      })
    });
    if (!resp.ok) {
      const errText = await resp.text();
      console.error(`[AI] DeepSeek API error ${resp.status}: ${errText}`);
      throw new Error(`DeepSeek API error ${resp.status}: ${errText}`);
    }
    const data = await resp.json();
    if (data?.choices?.[0]?.message?.content) {
      return data.choices[0].message.content;
    }
    throw new Error(`DeepSeek API response format unexpected: ${JSON.stringify(data)}`);
  }
  if (!env.AI) throw new Error("AI not configured: set AI_API_KEY env or add Workers AI binding");
  const aiModel = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
  async function runModel(name) {
    const result = await env.AI.run(name, {
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      max_tokens: 4096
    });
    if (typeof result === "string") return result;
    if (result?.choices?.[0]?.message?.content) return result.choices[0].message.content;
    if (typeof result?.response === "string") return result.response;
    if (typeof result?.result?.response === "string") return result.result.response;
    if (result instanceof Response) return await result.text();
    if (result?.response instanceof ReadableStream) {
      return await new Response(result.response).text();
    }
    return JSON.stringify(result);
  }
  try {
    return await runModel(aiModel);
  } catch (primaryErr) {
    try {
      return await runModel("@cf/meta/llama-3.1-8b-instruct");
    } catch (fallbackErr) {
      throw new Error(`AI inference failed: ${primaryErr.message}; fallback: ${fallbackErr.message}`);
    }
  }
}
function extractJSON(text) {
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  const start = cleaned.search(/[\[\{]/);
  const end = Math.max(cleaned.lastIndexOf("}"), cleaned.lastIndexOf("]"));
  if (start >= 0 && end > start) {
    return JSON.parse(cleaned.substring(start, end + 1));
  }
  return JSON.parse(cleaned);
}
var ENUM_FIELDS = /* @__PURE__ */ new Set([
  "role",
  "status",
  "urgency",
  "position_type",
  "screening_result",
  "stage",
  "reject_reason_category",
  "result",
  "interview_type",
  "interview_category",
  "test_type",
  "channel_type",
  "overall_result",
  "employment_type",
  "contract_type",
  "trigger_type",
  "node_type",
  "question_generation_status",
  "parse_status",
  "recommendation"
]);
function transformRow(row) {
  if (!row) return row;
  const result = {};
  for (const [key, value] of Object.entries(row)) {
    if (typeof value === "number" && (value === 0 || value === 1) && /^is_/.test(key)) {
      result[key] = value === 1;
    } else if (typeof value === "string" && value.length > 0 && (value[0] === "{" || value[0] === "[")) {
      try {
        result[key] = JSON.parse(value);
      } catch {
        result[key] = value;
      }
    } else if (ENUM_FIELDS.has(key) && typeof value === "string") {
      result[key] = value.toLowerCase();
    } else {
      result[key] = value;
    }
  }
  return result;
}
function prepareValue(v) {
  if (v === null || v === void 0) return null;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (typeof v === "object") return JSON.stringify(v);
  return v;
}
function validCol(name) {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);
}
function uuid() {
  return crypto.randomUUID();
}
function now() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
async function getUser(db, email) {
  const row = await db.prepare("SELECT * FROM users WHERE email = ?").bind(email).first();
  return row ? transformRow(row) : null;
}
var authMiddleware = async (c, next) => {
  const auth = c.req.header("Authorization") || "";
  const match2 = auth.match(/^Bearer\s+(.+)$/i);
  if (!match2) return c.json({ detail: "Not authenticated" }, 401);
  const payload = await verifyJwt(c.env.SECRET_KEY, match2[1]);
  if (!payload) return c.json({ detail: "Invalid token" }, 401);
  const user = await getUser(c.env.DB, payload.sub);
  if (!user) return c.json({ detail: "User not found" }, 401);
  if (!user.is_active) return c.json({ detail: "Account disabled" }, 403);
  c.set("user", user);
  await next();
};
function serializeUser(user) {
  const { hashed_password, ...rest } = user;
  return { ...rest, has_password: !!hashed_password, plain_password: rest.plain_password || (hashed_password ? "123456" : "") };
}
function requireRole(roles) {
  return async (c, next) => {
    const user = c.get("user");
    if (!user || !roles.includes(user.role)) {
      return c.json({ detail: "Operation not permitted" }, 403);
    }
    await next();
  };
}
app.post("/api/auth/token", async (c) => {
  const text = await c.req.text();
  const params = new URLSearchParams(text);
  const username = params.get("username") || "";
  const password = params.get("password") || "";
  if (!username || !password) return c.json({ detail: "Missing credentials" }, 400);
  const user = await getUser(c.env.DB, username);
  if (!user) return c.json({ detail: "Invalid credentials" }, 401);
  const ok = await verifyPassword(c.env.SECRET_KEY, password, user.hashed_password);
  if (!ok) return c.json({ detail: "Invalid credentials" }, 401);
  const token = await createJwt(c.env.SECRET_KEY, username);
  return c.json({ access_token: token, token_type: "bearer" });
});
app.get("/api/auth/me", authMiddleware, (c) => {
  const user = c.get("user");
  return c.json(serializeUser(user));
});
app.get("/api/auth/me/token", authMiddleware, async (c) => {
  const user = c.get("user");
  const token = await createJwt(c.env.SECRET_KEY, user.email);
  return c.json({ token });
});
app.put("/api/auth/me", authMiddleware, async (c) => {
  const user = c.get("user");
  const body = await c.req.json();
  const updates = {};
  for (const k of ["full_name", "feishu_open_id", "feishu_name"]) {
    if (body[k] !== void 0) updates[k] = body[k];
  }
  if (Object.keys(updates).length === 0) return c.json(serializeUser(user));
  const setClause = Object.keys(updates).map((k) => `${k} = ?`).join(", ");
  await c.env.DB.prepare(`UPDATE users SET ${setClause}, updated_at = ? WHERE id = ?`).bind(...Object.values(updates), now(), user.id).run();
  const updated = await getUser(c.env.DB, user.email);
  return c.json(serializeUser(updated));
});
app.put("/api/auth/change-password", authMiddleware, async (c) => {
  const user = c.get("user");
  const body = await c.req.json();
  const ok = await verifyPassword(c.env.SECRET_KEY, body.current_password || "", user.hashed_password);
  if (!ok) return c.json({ detail: "Current password incorrect" }, 400);
  const newHash = await hashPassword(c.env.SECRET_KEY, body.new_password || "");
  await c.env.DB.prepare("UPDATE users SET hashed_password = ?, updated_at = ? WHERE id = ?").bind(newHash, now(), user.id).run();
  return c.json({ detail: "Password changed" });
});
var FEISHU_REDIRECT_URI = "https://ai-interview-22u.pages.dev/api/auth/feishu-callback";
app.get("/api/auth/feishu-oauth-url", authMiddleware, async (c) => {
  const user = c.get("user");
  const token = await createJwt(c.env.SECRET_KEY, user.email);
  const baseUrl = c.env.FEISHU_OAUTH_REDIRECT_URI || FEISHU_REDIRECT_URI;
  const appId = c.env.FEISHU_APP_ID || FEISHU_CONFIG.appId;
  const scope = "offline_access";
  const oauthUrl = `https://accounts.feishu.cn/open-apis/authen/v1/authorize?client_id=${appId}&response_type=code&redirect_uri=${encodeURIComponent(baseUrl)}&state=${token}&scope=${scope}`;
  return c.json({ url: oauthUrl });
});
app.post("/api/auth/feishu-oauth-url", authMiddleware, requireRole(["admin"]), async (c) => {
  const body = await c.req.json();
  const email = body.email;
  if (!email) return c.json({ detail: "email required" }, 400);
  const token = await createJwt(c.env.SECRET_KEY, email);
  const baseUrl = c.env.FEISHU_OAUTH_REDIRECT_URI || FEISHU_REDIRECT_URI;
  const appId = c.env.FEISHU_APP_ID || FEISHU_CONFIG.appId;
  const scope = "offline_access";
  const oauthUrl = `https://accounts.feishu.cn/open-apis/authen/v1/authorize?client_id=${appId}&response_type=code&redirect_uri=${encodeURIComponent(baseUrl)}&state=${token}&scope=${scope}`;
  return c.json({ url: oauthUrl, email });
});
app.get("/api/auth/feishu-callback", async (c) => {
  try {
    const code = c.req.query("code") || "";
    const state = c.req.query("state") || "";
    if (!code) {
      console.error("[FeishuOAuth] \u7F3A\u5C11 code \u53C2\u6570");
      return c.redirect("/settings/profile?feishu_error=1&err=missing_code");
    }
    let userEmail = "";
    const payload = await verifyJwt(c.env.SECRET_KEY, state);
    if (payload && payload.sub) {
      userEmail = payload.sub;
    } else {
      userEmail = state.includes("@") ? state : "";
    }
    if (!userEmail) {
      console.error(`[FeishuOAuth] \u65E0\u6CD5\u4ECE state \u89E3\u6790\u7528\u6237\u8EAB\u4EFD: ${state.substring(0, 50)}...`);
      return c.redirect("/settings/profile?feishu_error=1&err=bad_state");
    }
    const appId = c.env.FEISHU_APP_ID || FEISHU_CONFIG.appId;
    const appSecret = c.env.FEISHU_APP_SECRET || FEISHU_CONFIG.appSecret;
    console.log(`[FeishuOAuth] \u4EA4\u6362 token: email=${userEmail}, appId=${appId}, code=${code.substring(0, 20)}...`);
    const baseUrl = c.env.FEISHU_OAUTH_REDIRECT_URI || FEISHU_REDIRECT_URI;
    const tokenResp = await fetch("https://open.feishu.cn/open-apis/authen/v2/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code,
        client_id: appId,
        client_secret: appSecret,
        redirect_uri: baseUrl
      })
    });
    const tokenData = await tokenResp.json();
    if (tokenData.code !== 0) {
      console.error(`[FeishuOAuth] token \u4EA4\u6362\u5931\u8D25: code=${tokenData.code}, msg=${tokenData.msg}`);
      return c.redirect(`/settings/profile?feishu_error=1&err=${encodeURIComponent("token\u4EA4\u6362\u5931\u8D25:" + tokenData.code + " " + tokenData.msg)}`);
    }
    const userAccessToken = tokenData.access_token || tokenData.data?.access_token;
    const refreshToken = tokenData.refresh_token || tokenData.data?.refresh_token || "";
    const tokenExpiresIn = tokenData.expires_in || tokenData.data?.expires_in || 7200;
    const refreshTokenExpiresIn = tokenData.refresh_token_expires_in || tokenData.data?.refresh_token_expires_in || 604800;
    console.log(`[FeishuOAuth] token \u4EA4\u6362\u6210\u529F, \u83B7\u53D6\u7528\u6237\u4FE1\u606F...`);
    const userInfoResp = await fetch("https://open.feishu.cn/open-apis/authen/v1/user_info", {
      headers: { Authorization: `Bearer ${userAccessToken}` }
    });
    const userInfoData = await userInfoResp.json();
    if (userInfoData.code !== 0) {
      console.error(`[FeishuOAuth] \u83B7\u53D6\u7528\u6237\u4FE1\u606F\u5931\u8D25: code=${userInfoData.code}, msg=${userInfoData.msg}`);
      return c.redirect(`/settings/profile?feishu_error=1&err=${encodeURIComponent("user\u4FE1\u606F\u5931\u8D25:" + userInfoData.code + " " + userInfoData.msg)}`);
    }
    const feishuOpenId = userInfoData.data.open_id || userInfoData.data.sub || "";
    const feishuName = userInfoData.data.name || "";
    console.log(`[FeishuOAuth] \u7528\u6237\u4FE1\u606F: openId=${feishuOpenId}, name=${feishuName}, \u66F4\u65B0 ${userEmail}...`);
    if (feishuOpenId) {
      await c.env.DB.prepare("UPDATE users SET feishu_open_id = ?, feishu_name = ?, feishu_token = ?, updated_at = ? WHERE email = ?").bind(feishuOpenId, feishuName, userAccessToken, now(), userEmail).run();
      const tokenId = uuid();
      const expiresAtUnix = Math.floor(Date.now() / 1e3) + tokenExpiresIn;
      await c.env.DB.prepare("DELETE FROM feishu_tokens WHERE user_email = ?").bind(userEmail).run();
      await c.env.DB.prepare(`
        INSERT INTO feishu_tokens (id, user_email, access_token, refresh_token, expires_at, open_id, name, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(tokenId, userEmail, userAccessToken, refreshToken, expiresAtUnix, feishuOpenId, feishuName, now()).run();
    }
    console.log(`[FeishuOAuth] \u7ED1\u5B9A\u6210\u529F, \u8DF3\u8F6C`);
    return c.redirect("/settings/profile?feishu_bound=1");
  } catch (e) {
    console.error(`[FeishuOAuth] \u5F02\u5E38: ${e.message}
${e.stack || ""}`);
    return c.redirect(`/settings/profile?feishu_error=1&err=${encodeURIComponent("exception:" + e.message)}`);
  }
});
app.put("/api/auth/me/feishu", authMiddleware, async (c) => {
  const user = c.get("user");
  const { feishu_open_id, feishu_name } = await c.req.json();
  await c.env.DB.prepare("UPDATE users SET feishu_open_id = ?, feishu_name = ?, updated_at = ? WHERE id = ?").bind(feishu_open_id || "", feishu_name || "", now(), user.id).run();
  const updated = await getUser(c.env.DB, user.email);
  return c.json(serializeUser(updated));
});
app.get("/api/auth/users", authMiddleware, requireRole(["admin"]), async (c) => {
  const result = await c.env.DB.prepare("SELECT * FROM users ORDER BY created_at DESC").all();
  return c.json(result.results.map(serializeUser));
});
app.post("/api/auth/users", authMiddleware, requireRole(["admin"]), async (c) => {
  const body = await c.req.json();
  const id = uuid();
  const password = body.password || "123456";
  const hash = await hashPassword(c.env.SECRET_KEY, password);
  await c.env.DB.prepare(
    "INSERT INTO users (id, email, hashed_password, plain_password, full_name, role, is_active, feishu_open_id, feishu_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 1, '', '', ?, ?)"
  ).bind(id, body.email, hash, password, body.full_name || "", (body.role || "hr").toLowerCase(), now(), now()).run();
  const user = await getUser(c.env.DB, body.email);
  const serialized = serializeUser(user);
  return c.json({ ...serialized, _plain_password: password });
});
app.put("/api/auth/users/:id", authMiddleware, requireRole(["admin"]), async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const updates = {};
  for (const k of ["full_name", "email", "role", "feishu_token"]) {
    if (body[k] !== void 0) updates[k] = k === "role" ? body[k].toLowerCase() : body[k];
  }
  if (body.is_active !== void 0) updates.is_active = body.is_active ? 1 : 0;
  if (body.password) updates.hashed_password = await hashPassword(c.env.SECRET_KEY, body.password);
  if (Object.keys(updates).length === 0) return c.json({ detail: "No updates" });
  const setClause = Object.keys(updates).map((k) => `${k} = ?`).join(", ");
  await c.env.DB.prepare(`UPDATE users SET ${setClause}, updated_at = ? WHERE id = ?`).bind(...Object.values(updates), now(), id).run();
  const row = await c.env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(id).first();
  return c.json(serializeUser(transformRow(row)));
});
app.put("/api/auth/users/:id/role", authMiddleware, requireRole(["admin"]), async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  await c.env.DB.prepare("UPDATE users SET role = ?, updated_at = ? WHERE id = ?").bind((body.role || "hr").toLowerCase(), now(), id).run();
  const row = await c.env.DB.prepare("SELECT * FROM users WHERE id = ?").bind(id).first();
  return c.json(serializeUser(transformRow(row)));
});
app.get("/api/auth/users/:id/status", authMiddleware, requireRole(["admin"]), async (c) => {
  const id = c.req.param("id");
  const row = await c.env.DB.prepare("SELECT is_active FROM users WHERE id = ?").bind(id).first();
  if (!row) return c.json({ detail: "User not found" }, 404);
  return c.json({ is_active: row.is_active === 1 });
});
app.put("/api/auth/users/:id/password", authMiddleware, requireRole(["admin"]), async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const newPassword = body.password || "123456";
  const hash = await hashPassword(c.env.SECRET_KEY, newPassword);
  await c.env.DB.prepare("UPDATE users SET hashed_password = ?, plain_password = ?, updated_at = ? WHERE id = ?").bind(hash, newPassword, now(), id).run();
  return c.json({ _plain_password: newPassword });
});
app.delete("/api/auth/users/:id", authMiddleware, requireRole(["admin"]), async (c) => {
  const id = c.req.param("id");
  await c.env.DB.prepare("DELETE FROM users WHERE id = ?").bind(id).run();
  return c.json({ detail: "User deleted" });
});
app.get("/api/auth/interviewers", authMiddleware, async (c) => {
  const result = await c.env.DB.prepare("SELECT * FROM users WHERE lower(role) = 'interviewer' AND is_active = 1").all();
  return c.json(result.results.map(serializeUser));
});
app.get("/api/question-banks", authMiddleware, async (c) => {
  const result = await c.env.DB.prepare("SELECT id, name, category, questions FROM question_banks ORDER BY created_at DESC").all();
  const banks = (result.results || []).map((row) => ({
    id: row.id,
    name: row.name,
    category: row.category || "technical",
    question_count: row.questions ? (() => {
      try {
        return JSON.parse(row.questions).length;
      } catch {
        return 0;
      }
    })() : 0
  }));
  return c.json(banks);
});
app.get("/api/dashboard/stats", authMiddleware, async (c) => {
  const db = c.env.DB;
  const activePos = await db.prepare("SELECT COUNT(*) as cnt FROM positions WHERE status IN ('open','published')").first();
  const pendingResumes = await db.prepare("SELECT COUNT(*) as cnt FROM resumes WHERE status IN ('pending_screening','pending_review','pending_dept_review','pending_hr_decision')").first();
  const todayInterviews = await db.prepare("SELECT COUNT(*) as cnt FROM interviews WHERE date(interview_time) = date('now')").first();
  return c.json({
    stats: {
      active_positions: activePos?.cnt || 0,
      pending_resumes: pendingResumes?.cnt || 0,
      today_interviews: todayInterviews?.cnt || 0,
      trends: { active_positions: 0, pending_resumes: 0, today_interviews: 0 }
    },
    recent_activities: []
  });
});
app.get("/api/dashboard/funnel", authMiddleware, async (c) => {
  const db = c.env.DB;
  const total = await db.prepare("SELECT COUNT(*) as cnt FROM resumes").first();
  const totalResumes = total?.cnt || 0;
  const stages = [
    { stage: "new", stage_name: "\u65B0\u7B80\u5386", field: "stage = 'new'" },
    { stage: "screening", stage_name: "\u7B5B\u9009\u4E2D", field: "stage = 'screening'" },
    { stage: "interview", stage_name: "\u9762\u8BD5\u4E2D", field: "stage = 'interview'" },
    { stage: "offer", stage_name: "Offer", field: "stage = 'offer'" },
    { stage: "hired", stage_name: "\u5DF2\u5165\u804C", field: "stage = 'hired'" }
  ];
  const result = [];
  for (const s of stages) {
    const r = await db.prepare(`SELECT COUNT(*) as cnt FROM resumes WHERE ${s.field}`).first();
    const count = r?.cnt || 0;
    result.push({
      stage: s.stage,
      stage_name: s.stage_name,
      count,
      percentage: totalResumes > 0 ? Math.round(count / totalResumes * 100) : 0
    });
  }
  return c.json({ stages: result, total_resumes: totalResumes, conversion_rate: totalResumes > 0 ? Math.round(result[4].count / totalResumes * 100) : 0 });
});
app.get("/api/dashboard/positions-detail", authMiddleware, async (c) => {
  const db = c.env.DB;
  const positions = await db.prepare(`SELECT * FROM positions ORDER BY created_at DESC`).all();
  const result = await Promise.all(positions.results.map(async (pos) => {
    const [
      rCnt,
      f1Cnt,
      f1Pass,
      f2Pass,
      f3Pass,
      oCnt,
      hCnt
    ] = await Promise.all([
      db.prepare("SELECT COUNT(*) as cnt FROM resumes WHERE position_id = ?").bind(pos.id).first(),
      db.prepare("SELECT COUNT(*) as cnt FROM interviews WHERE position_id = ? AND round = 1 AND status = 'scheduled'").bind(pos.id).first(),
      db.prepare("SELECT COUNT(*) as cnt FROM interviews WHERE position_id = ? AND round = 1 AND (result = 'pass' OR status2 = 'passed')").bind(pos.id).first(),
      db.prepare("SELECT COUNT(*) as cnt FROM interviews WHERE position_id = ? AND round = 2 AND (result = 'pass' OR status2 = 'passed')").bind(pos.id).first(),
      db.prepare("SELECT COUNT(*) as cnt FROM interviews WHERE position_id = ? AND round = 3 AND (result = 'pass' OR status2 = 'passed')").bind(pos.id).first(),
      db.prepare("SELECT COUNT(*) as cnt FROM offers WHERE position_id = ? AND status NOT IN ('draft','cancelled')").bind(pos.id).first(),
      db.prepare("SELECT COUNT(*) as cnt FROM onboarding_records WHERE position_id = ? AND status = 'onboarded'").bind(pos.id).first()
    ]);
    const totalResumes = rCnt?.cnt || 0;
    const firstInterview = (f1Cnt?.cnt || 0) + (f1Pass?.cnt || 0);
    const firstPass = f1Pass?.cnt || 0;
    const secondPass = f2Pass?.cnt || 0;
    const thirdPass = f3Pass?.cnt || 0;
    const offers = oCnt?.cnt || 0;
    const hired = hCnt?.cnt || 0;
    let passRate = "0%";
    if (firstInterview > 0) {
      passRate = Math.round(firstPass / firstInterview * 100) + "%";
    }
    const statusMap = {
      "open": "\u62DB\u8058\u4E2D",
      "published": "\u62DB\u8058\u4E2D",
      "closed": "\u5DF2\u5B8C\u6210",
      "draft": "\u8349\u7A3F",
      "paused": "\u6682\u505C",
      "cancelled": "\u5DF2\u7EC8\u6B62"
    };
    const displayStatus = statusMap[pos.status] || pos.status;
    return {
      division: pos.department || "",
      hrbp: "",
      position: pos.title,
      headcount: pos.headcount || 1,
      total_resumes: totalResumes,
      first_interview: firstInterview,
      first_pass: firstPass,
      second_pass: secondPass,
      third_pass: thirdPass,
      pass_rate: passRate,
      offers,
      hired,
      notes: "",
      status: displayStatus
    };
  }));
  return c.json(result);
});
app.get("/api/dashboard/interviewers", authMiddleware, async (c) => {
  const db = c.env.DB;
  const interviewers = await db.prepare("SELECT * FROM users WHERE lower(role) = 'interviewer'").all();
  const result = [];
  for (const u of interviewers.results) {
    const total = await db.prepare("SELECT COUNT(*) as cnt FROM interviews WHERE interviewer_id = ?").bind(u.id).first();
    const completed = await db.prepare("SELECT COUNT(*) as cnt FROM interviews WHERE interviewer_id = ? AND status = 'completed'").bind(u.id).first();
    const pending = await db.prepare("SELECT COUNT(*) as cnt FROM interviews WHERE interviewer_id = ? AND status IN ('scheduled','in_progress')").bind(u.id).first();
    const totalCnt = total?.cnt || 0;
    const completedCnt = completed?.cnt || 0;
    result.push({
      id: u.id,
      name: u.full_name,
      total_interviews: totalCnt,
      completed_interviews: completedCnt,
      pending_interviews: pending?.cnt || 0,
      completion_rate: totalCnt > 0 ? Math.round(completedCnt / totalCnt * 100) : 0,
      avg_score: null,
      score_std: null,
      consistency_rating: "N/A"
    });
  }
  return c.json(result);
});
app.get("/api/dashboard/overview", authMiddleware, async (c) => {
  const db = c.env.DB;
  const [
    activePos,
    totalPos,
    totalResumes,
    scheduledIvs,
    completedIvs,
    passedIvs,
    offersRs,
    hiredRs,
    pendingOb,
    totalOb
  ] = await Promise.all([
    db.prepare("SELECT COUNT(*) as cnt FROM positions WHERE status IN ('open','published')").first(),
    db.prepare("SELECT COALESCE(SUM(headcount),0) as cnt FROM positions WHERE status IN ('open','published')").first(),
    db.prepare("SELECT COUNT(*) as cnt FROM resumes").first(),
    db.prepare("SELECT COUNT(*) as cnt FROM interviews WHERE status = 'scheduled'").first(),
    db.prepare("SELECT COUNT(*) as cnt FROM interviews WHERE status = 'completed'").first(),
    db.prepare("SELECT COUNT(*) as cnt FROM interviews WHERE result = 'pass' OR status2 = 'passed'").first(),
    db.prepare("SELECT COUNT(*) as cnt FROM offers WHERE status NOT IN ('draft','cancelled')").first(),
    db.prepare("SELECT COUNT(*) as cnt FROM onboarding_records WHERE status = 'onboarded'").first(),
    db.prepare("SELECT COUNT(*) as cnt FROM onboarding_records WHERE status = 'pending'").first(),
    db.prepare("SELECT COUNT(*) as cnt FROM onboarding_records").first()
  ]);
  const ap = activePos?.cnt || 0;
  const th = totalPos?.cnt || 0;
  const tr = totalResumes?.cnt || 0;
  const si = scheduledIvs?.cnt || 0;
  const ci = completedIvs?.cnt || 0;
  const pi = passedIvs?.cnt || 0;
  const of = offersRs?.cnt || 0;
  const hi = hiredRs?.cnt || 0;
  const po = pendingOb?.cnt || 0;
  const pushConversionRate = tr > 0 ? Math.round((si + ci) / tr * 100) : 0;
  const interviewPassRate = ci > 0 ? Math.round(pi / ci * 100) : 0;
  const offerConversionRate = pi > 0 ? Math.round(of / pi * 100) : 0;
  const hireConversionRate = of > 0 ? Math.round(hi / of * 100) : 0;
  return c.json({
    overview: {
      active_positions: ap,
      total_headcount: th,
      total_resumes: tr,
      scheduled_interviews: si,
      push_conversion_rate: pushConversionRate,
      interview_pass_rate: interviewPassRate,
      offers: of,
      offer_conversion_rate: offerConversionRate,
      hired: hi,
      hire_conversion_rate: hireConversionRate,
      pending_onboarding: po,
      last_updated: (/* @__PURE__ */ new Date()).toISOString()
    },
    funnel: {
      stages: [
        { name: "\u7B80\u5386\u63A8\u9001", count: tr },
        { name: "\u5B89\u6392\u9762\u8BD5", count: si + ci },
        { name: "\u9762\u8BD5\u901A\u8FC7", count: pi },
        { name: "\u53D1\u653EOffer", count: of },
        { name: "\u5DF2\u5165\u804C", count: hi }
      ]
    },
    divisions: []
  });
});
app.get("/api/dashboard/hr-stats", authMiddleware, async (c) => {
  const db = c.env.DB;
  const totalReq = await db.prepare("SELECT COUNT(*) as cnt FROM job_requisitions").first();
  const pendingReq = await db.prepare("SELECT COUNT(*) as cnt FROM job_requisitions WHERE status = 'pending'").first();
  const approvedReq = await db.prepare("SELECT COUNT(*) as cnt FROM job_requisitions WHERE status = 'approved'").first();
  const pipelineAccCnt = await db.prepare("SELECT COUNT(*) as cnt FROM resume_screening_queue WHERE status = 'approved'").first();
  const obCnt = await db.prepare("SELECT COUNT(*) as cnt FROM onboarding_records").first();
  const pbCnt = await db.prepare("SELECT COUNT(*) as cnt FROM probation_records").first();
  return c.json({
    total_requisitions: totalReq?.cnt || 0,
    pending_requisitions: pendingReq?.cnt || 0,
    approved_requisitions: approvedReq?.cnt || 0,
    pipeline_candidates: pipelineAccCnt?.cnt || 0,
    onboarding_count: obCnt?.cnt || 0,
    probation_count: pbCnt?.cnt || 0
  });
});
app.get("/api/dashboard/timeline", authMiddleware, async (c) => {
  const days = parseInt(c.req.query("days") || "30");
  const result = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 864e5);
    result.push({
      date: d.toISOString().slice(0, 10),
      resumes_received: 0,
      interviews_scheduled: 0
    });
  }
  return c.json(result);
});
app.get("/api/dashboard/module-stats", authMiddleware, async (c) => {
  const db = c.env.DB;
  const [
    reqCnt,
    reqPending,
    reqApproved,
    tpCnt,
    posCnt,
    posActive,
    posOpen,
    resumeCnt,
    resumePending,
    resumeScreening,
    ivCnt,
    ivScheduled,
    ivToday,
    onboardCnt,
    onboardPending,
    onboardHired,
    probCnt,
    probActive,
    userCnt,
    interviewerCnt
  ] = await Promise.all([
    db.prepare("SELECT COUNT(*) as c FROM job_requisitions").first().catch(() => ({ c: 0 })),
    db.prepare("SELECT COUNT(*) as c FROM job_requisitions WHERE status='pending'").first().catch(() => ({ c: 0 })),
    db.prepare("SELECT COUNT(*) as c FROM job_requisitions WHERE status='approved'").first().catch(() => ({ c: 0 })),
    db.prepare("SELECT COUNT(*) as c FROM resume_screening_queue WHERE status='approved'").first().catch(() => ({ c: 0 })),
    db.prepare("SELECT COUNT(*) as c FROM positions").first().catch(() => ({ c: 0 })),
    db.prepare("SELECT COUNT(*) as c FROM positions WHERE status IN ('open','published')").first().catch(() => ({ c: 0 })),
    db.prepare("SELECT COUNT(*) as c FROM positions WHERE status='open'").first().catch(() => ({ c: 0 })),
    db.prepare("SELECT COUNT(*) as c FROM resumes").first().catch(() => ({ c: 0 })),
    db.prepare("SELECT COUNT(*) as c FROM resumes WHERE status LIKE 'pending%' OR status='new'").first().catch(() => ({ c: 0 })),
    db.prepare("SELECT COUNT(*) as c FROM resumes WHERE status='screening'").first().catch(() => ({ c: 0 })),
    db.prepare("SELECT COUNT(*) as c FROM interviews").first().catch(() => ({ c: 0 })),
    db.prepare("SELECT COUNT(*) as c FROM interviews WHERE status='scheduled'").first().catch(() => ({ c: 0 })),
    db.prepare("SELECT COUNT(*) as c FROM interviews WHERE date(interview_time)=date('now')").first().catch(() => ({ c: 0 })),
    db.prepare("SELECT COUNT(*) as c FROM onboarding_records").first().catch(() => ({ c: 0 })),
    db.prepare("SELECT COUNT(*) as c FROM onboarding_records WHERE status='pending'").first().catch(() => ({ c: 0 })),
    db.prepare("SELECT COUNT(*) as c FROM onboarding_records WHERE status='onboarded'").first().catch(() => ({ c: 0 })),
    db.prepare("SELECT COUNT(*) as c FROM probation_records").first().catch(() => ({ c: 0 })),
    db.prepare("SELECT COUNT(*) as c FROM probation_records WHERE status='active' OR status='probation'").first().catch(() => ({ c: 0 })),
    db.prepare("SELECT COUNT(*) as c FROM users WHERE is_active=1").first().catch(() => ({ c: 0 })),
    db.prepare("SELECT COUNT(*) as c FROM users WHERE role='interviewer' AND is_active=1").first().catch(() => ({ c: 0 }))
  ]);
  return c.json({
    modules: [
      { key: "requisitions", label: "\u9700\u6C42\u7BA1\u7406", count: reqCnt?.c || 0, sub: `\u5F85\u5BA1\u6279 ${reqPending?.c || 0} / \u5DF2\u6279\u51C6 ${reqApproved?.c || 0}` },
      { key: "interviews_pipeline", label: "\u9762\u8BD5\u6D41\u6C34\u7EBF", count: tpCnt?.c || 0, sub: "\u5DF2\u5165\u5E93\u5019\u9009\u4EBA" },
      { key: "positions", label: "\u5C97\u4F4D\u7BA1\u7406", count: posCnt?.c || 0, sub: `\u5728\u62DB ${posActive?.c || 0} / \u5F00\u653E ${posOpen?.c || 0}` },
      { key: "resumes", label: "\u7B80\u5386\u7BA1\u7406", count: resumeCnt?.c || 0, sub: `\u5F85\u5904\u7406 ${resumePending?.c || 0} / \u7B5B\u9009\u4E2D ${resumeScreening?.c || 0}` },
      { key: "interviews", label: "\u9762\u8BD5\u7BA1\u7406", count: ivCnt?.c || 0, sub: `\u5F85\u9762\u8BD5 ${ivScheduled?.c || 0} / \u4ECA\u65E5 ${ivToday?.c || 0}` },
      { key: "onboarding", label: "\u5165\u804C\u7BA1\u7406", count: onboardCnt?.c || 0, sub: `\u5F85\u5165\u804C ${onboardPending?.c || 0} / \u5DF2\u5165\u804C ${onboardHired?.c || 0}` },
      { key: "probation", label: "\u8BD5\u7528\u671F\u7BA1\u7406", count: probCnt?.c || 0, sub: `\u8FDB\u884C\u4E2D ${probActive?.c || 0}` },
      { key: "users", label: "\u7528\u6237\u7BA1\u7406", count: userCnt?.c || 0, sub: `\u9762\u8BD5\u5B98 ${interviewerCnt?.c || 0}` }
    ]
  });
});
app.get("/api/dashboard/ai-insights", authMiddleware, async (c) => {
  const db = c.env.DB;
  const totalResumes = await db.prepare("SELECT COUNT(*) as cnt FROM resumes").first();
  const pendingResumes = await db.prepare("SELECT COUNT(*) as cnt FROM resumes WHERE status LIKE 'pending%'").first();
  const totalPositions = await db.prepare("SELECT COUNT(*) as cnt FROM positions").first();
  const activePositions = await db.prepare("SELECT COUNT(*) as cnt FROM positions WHERE status IN ('open','published')").first();
  const totalInterviews = await db.prepare("SELECT COUNT(*) as cnt FROM interviews").first();
  const completedInterviews = await db.prepare("SELECT COUNT(*) as cnt FROM interviews WHERE status = 'completed'").first();
  const stats = {
    total_resumes: totalResumes?.cnt || 0,
    pending_resumes: pendingResumes?.cnt || 0,
    total_positions: totalPositions?.cnt || 0,
    active_positions: activePositions?.cnt || 0,
    total_interviews: totalInterviews?.cnt || 0,
    completed_interviews: completedInterviews?.cnt || 0
  };
  const deptResult = await db.prepare("SELECT department, COUNT(*) as cnt FROM positions GROUP BY department ORDER BY cnt DESC LIMIT 10").all();
  const departmentDist = deptResult.results.map((r) => ({ department: r.department, count: r.cnt }));
  const stageResult = await db.prepare("SELECT stage, COUNT(*) as cnt FROM resumes GROUP BY stage").all();
  const stageDist = stageResult.results.map((r) => ({ stage: r.stage, count: r.cnt }));
  const systemPrompt = `You are an expert HR data analyst AI. Analyze the recruitment data and provide insights in Chinese. Return a JSON object with:
- summary: overall summary in Chinese (2-3 sentences)
- bottlenecks: array of { area, description } in Chinese
- recommendations: array of { priority, action } in Chinese
- predictions: array of { metric, prediction } in Chinese`;
  const userPrompt = `Recruitment Data:
${JSON.stringify(stats, null, 2)}

Department Distribution:
${JSON.stringify(departmentDist, null, 2)}

Resume Stage Distribution:
${JSON.stringify(stageDist, null, 2)}

Please analyze and provide insights.`;
  try {
    const result = await callAI(c.env, systemPrompt, userPrompt, "deepseek-v4-flash");
    let insights;
    try {
      insights = extractJSON(result);
    } catch {
      insights = { summary: result, bottlenecks: [], recommendations: [], predictions: [] };
    }
    return c.json(insights);
  } catch (err) {
    return c.json({ detail: "AI insights failed", error: err.message }, 500);
  }
});
function makeListHandler(table, filters = {}) {
  return async (c) => {
    const db = c.env.DB;
    let sql = `SELECT * FROM ${table}`;
    const conditions = [];
    const binds = [];
    for (const [col, mode] of Object.entries(filters)) {
      const val = c.req.query(col);
      if (val !== void 0 && val !== "" && validCol(col)) {
        if (mode === "like") {
          conditions.push(`${col} LIKE ?`);
          binds.push(`%${val}%`);
        } else {
          conditions.push(`${col} = ?`);
          binds.push(val);
        }
      }
    }
    const search = c.req.query("search");
    if (search) {
      conditions.push(`(candidate_name LIKE ? OR email LIKE ?)`);
      binds.push(`%${search}%`, `%${search}%`);
    }
    if (conditions.length > 0) sql += " WHERE " + conditions.join(" AND ");
    sql += " ORDER BY created_at DESC";
    const result = await db.prepare(sql).bind(...binds).all();
    return c.json(result.results.map(transformRow));
  };
}
function makeGetHandler(table) {
  return async (c) => {
    const row = await c.env.DB.prepare(`SELECT * FROM ${table} WHERE id = ?`).bind(c.req.param("id")).first();
    if (!row) return c.json({ detail: "Not found" }, 404);
    return c.json(transformRow(row));
  };
}
function makeCreateHandler(table) {
  return async (c) => {
    const body = await c.req.json();
    const cols = [];
    const vals = [];
    if (!body.id) {
      cols.push("id");
      vals.push(uuid());
    }
    cols.push("created_at");
    vals.push(now());
    cols.push("updated_at");
    vals.push(now());
    for (const [k, v] of Object.entries(body)) {
      if (validCol(k) && !["id", "created_at", "updated_at"].includes(k)) {
        cols.push(k);
        vals.push(prepareValue(v));
      }
    }
    const placeholders = cols.map(() => "?").join(", ");
    const sql = `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${placeholders})`;
    await c.env.DB.prepare(sql).bind(...vals).run();
    const id = vals[0];
    const row = await c.env.DB.prepare(`SELECT * FROM ${table} WHERE id = ?`).bind(id).first();
    return c.json(transformRow(row));
  };
}
function makeUpdateHandler(table) {
  return async (c) => {
    const id = c.req.param("id");
    const body = await c.req.json();
    const cols = [];
    const vals = [];
    for (const [k, v] of Object.entries(body)) {
      if (validCol(k) && !["id", "created_at"].includes(k)) {
        cols.push(k);
        vals.push(prepareValue(v));
      }
    }
    cols.push("updated_at");
    vals.push(now());
    if (cols.length <= 1) return c.json({ detail: "No updates" });
    const setClause = cols.map((k) => `${k} = ?`).join(", ");
    await c.env.DB.prepare(`UPDATE ${table} SET ${setClause} WHERE id = ?`).bind(...vals, id).run();
    const row = await c.env.DB.prepare(`SELECT * FROM ${table} WHERE id = ?`).bind(id).first();
    return c.json(transformRow(row));
  };
}
function makeDeleteHandler(table) {
  return async (c) => {
    await c.env.DB.prepare(`DELETE FROM ${table} WHERE id = ?`).bind(c.req.param("id")).run();
    return c.json({ detail: "Deleted" });
  };
}
function registerCrud(prefix, table, filters = {}) {
  app.get(`/api/${prefix}`, authMiddleware, makeListHandler(table, filters));
  app.post(`/api/${prefix}`, authMiddleware, makeCreateHandler(table));
  app.get(`/api/${prefix}/:id`, authMiddleware, makeGetHandler(table));
  app.put(`/api/${prefix}/:id`, authMiddleware, makeUpdateHandler(table));
  app.delete(`/api/${prefix}/:id`, authMiddleware, makeDeleteHandler(table));
}
var FEISHU_REQUISITION_FIELDS = {
  title: "\u62DB\u8058\u5C97\u4F4D",
  department: "\u4E8C\u7EA7\u90E8\u95E8",
  department_3rd: "\u4E09\u7EA7\u90E8\u95E8",
  city: "\u62DB\u8058\u57CE\u5E02",
  headcount: "\u62DB\u8058\u4EBA\u6570",
  urgency: "\u7D27\u6025\u5EA6",
  status: "\u62DB\u8058\u72B6\u6001",
  reason: "\u62DB\u8058\u7406\u7531",
  notes: "\u8BF4\u660E",
  description: "\u62DB\u8058JD",
  requirements: "\u5C97\u4F4D\u804C\u8D23\u4E0E\u4EFB\u804C\u8981\u6C42",
  capability_requirements: "\u5C97\u4F4D\u80FD\u529B\u63D0\u53D6",
  capability_dimensions: "\u5C97\u4F4D\u80FD\u529B\u7EF4\u5EA6\u8981\u6C42",
  city_tier: "\u57CE\u5E02\u7B49\u7EA7",
  in_budget: "\u662F\u5426\u5728\u7F16\u5236\u5185",
  responsible_person: "\u8D23\u4EFB\u4EBA",
  recruitment_account: "\u62DB\u8058\u8D26\u53F7",
  start_date: "\u5F00\u59CB\u62DB\u8058",
  end_date: "\u7ED3\u675F\u62DB\u8058",
  hr_interviewer: "HR\u4E8C\u9762",
  biz_interviewer: "\u4E1A\u52A1\u4E00\u9762",
  final_interviewer: "\u7EC8\u9762"
};
function getBitableTableId(env, type) {
  if (type === "requisition") return env.FEISHU_REQUISITION_TABLE_ID || FEISHU_CONFIG.requisitionTableId;
  return env.FEISHU_TALENT_TABLE_ID || FEISHU_CONFIG.talentTableId;
}
function feishuFieldsToRecord(fields, data) {
  const result = {};
  for (const [engKey, cnKey] of Object.entries(fields)) {
    if (data[engKey] !== void 0 && data[engKey] !== null) {
      result[cnKey] = data[engKey];
    }
  }
  return result;
}
function getFirstValue(v) {
  if (v === null || v === void 0) return null;
  if (Array.isArray(v)) {
    const texts = v.map((item) => {
      if (typeof item === "string") return item;
      if (item?.text) return item.text;
      if (item?.name) return item.name;
      if (item?.content) return item.content;
      return null;
    }).filter(Boolean);
    return texts.length > 0 ? texts.join("") : null;
  }
  if (typeof v === "object" && v.name) return v.name;
  if (typeof v === "object" && v.text) return v.text;
  if (typeof v === "object" && v.content) return v.content;
  return String(v);
}
var defaultIfEmpty = (val, def) => {
  if (val === null || val === void 0 || val === "" || val === "\u65E0" || val === "None" || val === "null") return def;
  const s = String(val).trim();
  if (!s || s === "\u65E0" || s === "None" || s === "null") return def;
  return s;
};
var parseAge = (val) => {
  if (val === null || val === void 0 || val === "" || val === "\u65E0" || val === "None" || val === "null") return 20;
  const n = parseInt(String(val).replace(/[^\d]/g, ""));
  return isNaN(n) ? 20 : n;
};
function parseTalentRecord(record) {
  const f = record.fields || {};
  const rawAiEval = f["AI\u7B80\u5386\u8BC4\u4F30"];
  const aiEvalStr = typeof rawAiEval === "object" ? JSON.stringify(rawAiEval) : String(rawAiEval || "");
  const rawAdvantage = f["\u4F18\u52BF\u5206\u6790"];
  const advantageStr = typeof rawAdvantage === "object" ? JSON.stringify(rawAdvantage) : String(rawAdvantage || "");
  const rawRisk = f["\u98CE\u9669\u70B9"];
  const riskStr = typeof rawRisk === "object" ? JSON.stringify(rawRisk) : String(rawRisk || "");
  return {
    id: record.record_id,
    candidate_name: getFirstValue(f["\u59D3\u540D"]) || "\u672A\u77E5",
    position_applied: getFirstValue(f["\u9762\u8BD5\u5C97\u4F4D"]) || getFirstValue(f["\u62DB\u8058\u5C97\u4F4D"]) || "\u672A\u77E5",
    mapped_position: getFirstValue(f["\u62DB\u8058\u5C97\u4F4D\u5339\u914D"]) || "",
    gender: defaultIfEmpty(getFirstValue(f["\u6027\u522B"]), "\u672A\u77E5"),
    city: defaultIfEmpty(getFirstValue(f["\u57CE\u5E02"]), "\u672A\u77E5"),
    age: parseAge(f["\u5E74\u9F84"]),
    education: defaultIfEmpty(getFirstValue(f["\u5B66\u5386"]), "\u672A\u77E5"),
    ai_evaluation: aiEvalStr,
    screening_result: getFirstValue(f["AI\u7B80\u5386\u521D\u7B5B\u7ED3\u679C"]) || "",
    advantage: advantageStr,
    risk: riskStr,
    hr_review: getFirstValue(f["HR\u590D\u6838\u7ED3\u679C"]) || "",
    interview_suggestion: getFirstValue(f["\u4E00\u9762\u5EFA\u8BAE"]) || "",
    interview_questions: getFirstValue(f["\u9762\u8BD5\u95EE\u9898\u5EFA\u8BAE"]) || "",
    notes: getFirstValue(f["\u5907\u6CE8-\u624B\u52A8"]) || "",
    reserve_type: getFirstValue(f["\u50A8\u5907\u4EBA\u624D\u7C7B\u578B-\u624B\u52A8"]) || "",
    source_id: getFirstValue(f["SourceID"]) || "",
    biz_owner: getFirstValue(f["\u4E1A\u52A1\u8D1F\u8D23\u4EBA"]) || "",
    biz_review: getFirstValue(f["\u4E1A\u52A1\u590D\u6838\u7ED3\u679C"]) || "",
    hr_pass_date: f["HR\u521D\u7B5B\u901A\u8FC7\u65E5\u671F"] || null,
    create_time: f["\u521B\u5EFA\u65F6\u95F4"] || null,
    status: mapHrReviewToStatus(getFirstValue(f["HR\u590D\u6838\u7ED3\u679C"]) || ""),
    match_score: extractScoreFromEval(aiEvalStr),
    feishu_record_id: record.record_id,
    email: getFirstValue(f["SourceID"]) || "",
    // 保留原始字段以便扩展
    _raw_fields: f,
    // 简历附件信息（原始 PDF）
    resume_file: extractResumeFile(f["\u7B80\u5386\u9644\u4EF6-\u6279\u91CF\u5BFC\u5165"])
  };
}
function extractResumeFile(fieldValue) {
  if (!fieldValue) return null;
  if (Array.isArray(fieldValue) && fieldValue.length > 0) {
    const first = fieldValue[0];
    return {
      file_token: first.file_token || "",
      name: first.name || "",
      size: first.size || 0,
      download_url: first.tmp_url || ""
    };
  }
  return null;
}
async function buildPositionMapping(db) {
  const map = /* @__PURE__ */ new Map();
  const mappings = await db.prepare("SELECT raw_name, mapped_name FROM position_mappings").all();
  (mappings.results || []).forEach((r) => {
    if (r.raw_name && r.mapped_name) map.set(r.raw_name, r.mapped_name);
  });
  return map;
}
async function getPositionRequirements(env, positionName) {
  if (!positionName) return null;
  let mappedName = "";
  const pmRow = await env.DB.prepare("SELECT mapped_name FROM position_mappings WHERE raw_name LIKE ? LIMIT 1").bind(`%${positionName}%`).first();
  if (pmRow?.mapped_name) mappedName = pmRow.mapped_name;
  if (!mappedName) mappedName = positionName;
  const posRow = await env.DB.prepare(
    "SELECT title, description, requirements, personalized_requirements, capability_dimensions FROM positions WHERE title = ? LIMIT 1"
  ).bind(mappedName).first();
  if (!posRow) return null;
  let dimensions = [];
  try {
    const rawDims = typeof posRow.capability_dimensions === "string" ? JSON.parse(posRow.capability_dimensions) : posRow.capability_dimensions || [];
    if (Array.isArray(rawDims)) {
      dimensions = rawDims.map(
        (d) => typeof d === "string" ? { name: d, description: "" } : d
      );
    }
  } catch {
  }
  return {
    positionTitle: posRow.title,
    description: posRow.description || "",
    requirements: posRow.requirements || "",
    personalized_requirements: posRow.personalized_requirements || "",
    capability_dimensions: dimensions
  };
}
function parseFilenameInfo(name) {
  const empty = { position: null, location: null, salary: null, cleanName: null, metaInfo: "" };
  if (!name) return empty;
  const match2 = name.match(/【([^】]+)】\s*(.+)/);
  if (match2) {
    const inside = match2[1];
    const after = match2[2];
    const parts = inside.split("_");
    const position = parts[0]?.trim() || null;
    const location = parts[1]?.trim() || null;
    const salary = parts[2]?.trim() || null;
    let cleanName = null;
    let metaInfo = "";
    if (after) {
      const afterParts = after.split("_");
      cleanName = afterParts[0]?.trim() || null;
      if (afterParts.length > 1) {
        metaInfo = afterParts.slice(1).join("_").trim();
      }
    }
    return { position, location, salary, cleanName, metaInfo };
  }
  return empty;
}
function parseCapabilityDimensions(raw2) {
  if (!raw2) return "[]";
  if (typeof raw2 === "string" && raw2.trim().startsWith("[")) {
    try {
      const arr = JSON.parse(raw2);
      if (Array.isArray(arr)) return raw2;
    } catch {
    }
  }
  if (Array.isArray(raw2)) {
    const items2 = raw2.map((d) => {
      if (typeof d === "string") return { name: d, description: "" };
      if (d.name) return { name: d.name, description: d.description || d.definition || "" };
      return null;
    }).filter(Boolean);
    return JSON.stringify(items2);
  }
  const text = String(raw2).trim();
  if (!text || text === "\u65E0") return "[]";
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const items = lines.map((line) => {
    const sep = line.indexOf("\uFF1A") !== -1 ? "\uFF1A" : line.indexOf(":") !== -1 ? ":" : null;
    if (sep) {
      const idx = line.indexOf(sep);
      const name = line.substring(0, idx).trim();
      const description = line.substring(idx + 1).trim();
      if (name) return { name, description: description || "" };
    }
    return { name: line, description: "" };
  });
  return JSON.stringify(items);
}
function parseRequisitionRecord(record) {
  const f = record.fields || {};
  const headcount = f["\u62DB\u8058\u4EBA\u6570"] || 1;
  const urgency = mapUrgency(f["\u7D27\u6025\u5EA6"]);
  const status = mapStatus(f["\u62DB\u8058\u72B6\u6001"]);
  const notes = getFirstValue(f["\u8BF4\u660E"]) || "";
  let salaryRange = "";
  const salaryMatch = notes.match(/薪资范围:\s*(\S+)/);
  if (salaryMatch) salaryRange = salaryMatch[1];
  let personalizedReq = "";
  const reqMatch = notes.match(/个性化需求:\s*(.+?)(?:\n|$)/);
  if (reqMatch) personalizedReq = reqMatch[1];
  return {
    id: record.record_id,
    title: defaultIfEmpty(getFirstValue(f["\u62DB\u8058\u5C97\u4F4D"]), "(\u672A\u547D\u540D\u5C97\u4F4D)"),
    department: defaultIfEmpty(getFirstValue(f["\u4E8C\u7EA7\u90E8\u95E8"]), "\u672A\u77E5"),
    department_3rd: defaultIfEmpty(getFirstValue(f["\u4E09\u7EA7\u90E8\u95E8"]), "\u672A\u77E5"),
    location: defaultIfEmpty(getFirstValue(f["\u62DB\u8058\u57CE\u5E02"]), "\u672A\u77E5"),
    headcount: typeof headcount === "number" ? headcount : parseInt(String(headcount)) || 1,
    urgency,
    status,
    reason: defaultIfEmpty(getFirstValue(f["\u62DB\u8058\u7406\u7531"]), "\u65E0"),
    notes,
    description: defaultIfEmpty(getFirstValue(f["\u62DB\u8058JD"]), "\u65E0"),
    requirements: defaultIfEmpty(getFirstValue(f["\u5C97\u4F4D\u804C\u8D23\u4E0E\u4EFB\u804C\u8981\u6C42"]), "\u65E0"),
    capability_requirements: defaultIfEmpty(getFirstValue(f["\u5C97\u4F4D\u80FD\u529B\u63D0\u53D6"]), "\u65E0"),
    capability_dimensions: parseCapabilityDimensions(getFirstValue(f["\u5C97\u4F4D\u80FD\u529B\u7EF4\u5EA6\u8981\u6C42"])),
    personalized_requirements: defaultIfEmpty(personalizedReq, "\u65E0"),
    city_tier: defaultIfEmpty(getFirstValue(f["\u57CE\u5E02\u7B49\u7EA7"]), "\u672A\u77E5"),
    in_budget: defaultIfEmpty(getFirstValue(f["\u662F\u5426\u5728\u7F16\u5236\u5185"]), "\u672A\u77E5"),
    responsible_person: getUserName(f["\u8D23\u4EFB\u4EBA"]) || defaultIfEmpty(getFirstValue(f["\u62DB\u8058\u8D26\u53F7"]), "\u5F85\u5206\u914D"),
    recruitment_account: defaultIfEmpty(getFirstValue(f["\u62DB\u8058\u8D26\u53F7"]), "\u65E0"),
    hr_interviewer: getUserName(f["HR\u4E8C\u9762"]),
    biz_interviewer: getUserName(f["\u4E1A\u52A1\u4E00\u9762"]),
    final_interviewer: getUserName(f["\u7EC8\u9762"]),
    primary_interviewer: getUserName(f["\u4E1A\u52A1\u4E00\u9762"]) || "\u675C\u96C1\u73B2",
    secondary_interviewer: getUserName(f["HR\u4E8C\u9762"]) || "\u4F55\u96E8\u83F1",
    start_date: f["\u5F00\u59CB\u62DB\u8058"] || null,
    end_date: f["\u7ED3\u675F\u62DB\u8058"] || null,
    employment_type: "full_time",
    salary_range: defaultIfEmpty(salaryRange, "\u672A\u77E5"),
    budget: null,
    expected_date: null,
    feishu_record_id: record.record_id
  };
}
function extractScoreFromEval(evalStr) {
  if (!evalStr) return null;
  const match2 = evalStr.match(/匹配[度分][：:]\s*(\d+)/);
  if (match2) return parseInt(match2[1]);
  const match22 = evalStr.match(/(\d+)\s*分/);
  if (match22) return parseInt(match22[1]);
  return null;
}
function mapHrReviewToStatus(review) {
  const map = {
    "\u901A\u8FC7": "approved",
    "\u672A\u901A\u8FC7": "rejected",
    "\u53EF\u8FDB\u5165\u9762\u8BD5": "pending_interview",
    "\u5F85\u5B9A": "pending_review",
    "\u50A8\u5907": "waitlist"
  };
  return map[review] || "pending_screening";
}
function extractFeishuUsers(fieldValue) {
  if (!fieldValue) return [];
  if (fieldValue.users && Array.isArray(fieldValue.users)) {
    return fieldValue.users.map((u) => ({
      open_id: u.id || "",
      name: u.name || "",
      email: u.email || ""
    })).filter((u) => u.open_id);
  }
  if (Array.isArray(fieldValue)) {
    return fieldValue.map((u) => ({
      open_id: u.id || "",
      name: u.name || "",
      email: u.email || ""
    })).filter((u) => u.open_id);
  }
  return [];
}
function mapUrgency(v) {
  if (typeof v === "string") {
    const num = parseInt(v);
    if (num >= 1 && num <= 4) {
      const map = { 1: "low", 2: "medium", 3: "high", 4: "urgent" };
      return map[num] || "medium";
    }
    const zhMap = { "\u4F4E": "low", "\u4E2D": "medium", "\u9AD8": "high", "\u7D27\u6025": "urgent" };
    const enMap = { "low": "low", "medium": "medium", "high": "high", "urgent": "urgent" };
    return zhMap[v] || enMap[v] || v || "medium";
  }
  if (typeof v === "object" && v) return v.text || v.name || String(v);
  if (typeof v === "number") {
    const map = { 1: "low", 2: "medium", 3: "high", 4: "urgent" };
    return map[v] || "medium";
  }
  return "medium";
}
function mapStatus(v) {
  const s = typeof v === "object" && v ? v.text || v.name || "" : String(v || "");
  const map = {
    "\u62DB\u8058\u4E2D": "open",
    "\u6682\u505C": "paused",
    "\u5DF2\u5B8C\u6210": "closed",
    "\u5DF2\u5173\u95ED": "closed",
    "\u5DF2\u7EC8\u6B62": "cancelled"
  };
  return map[s] || s;
}
function getUserName(v) {
  if (!v) return "";
  if (typeof v === "string") return v;
  if (Array.isArray(v)) {
    const first = v[0];
    if (!first) return "";
    if (first.name) return first.name;
    if (first.text) return first.text;
    return String(first);
  }
  if (v.name) return v.name;
  if (v.text) return v.text;
  return String(v);
}
async function bitableListRecords(env, tableId, pageSize = 500) {
  const cached = bitableCache.get(tableId);
  if (cached && Date.now() < cached.expiry) {
    return cached.data;
  }
  const token = await getFeishuToken(env);
  const appToken = env.FEISHU_BITABLE_APP_TOKEN || FEISHU_CONFIG.appToken;
  const allRecords = [];
  let pageToken = null;
  do {
    let url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records?page_size=${pageSize}`;
    if (pageToken) url += `&page_token=${pageToken}`;
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await resp.json();
    if (!data.data) throw new Error(`Failed to get records: ${JSON.stringify(data)}`);
    allRecords.push(...data.data.items || []);
    pageToken = data.data.page_token || null;
    if (!data.data.has_more) break;
  } while (pageToken);
  bitableCache.set(tableId, { data: allRecords, expiry: Date.now() + BITABLE_CACHE_TTL });
  return allRecords;
}
async function bitableGetRecord(env, tableId, recordId) {
  const token = await getFeishuToken(env);
  const appToken = env.FEISHU_BITABLE_APP_TOKEN || FEISHU_CONFIG.appToken;
  const resp = await fetch(
    `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records/${recordId}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const data = await resp.json();
  return data.data?.record || null;
}
async function bitableCreateRecord(env, tableId, fields) {
  bitableCache.delete(tableId);
  const token = await getFeishuToken(env);
  const appToken = env.FEISHU_BITABLE_APP_TOKEN || FEISHU_CONFIG.appToken;
  const resp = await fetch(
    `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ fields })
    }
  );
  const data = await resp.json();
  return data.data?.record?.record_id || null;
}
async function bitableUpdateRecord(env, tableId, recordId, fields) {
  bitableCache.delete(tableId);
  const token = await getFeishuToken(env);
  const appToken = env.FEISHU_BITABLE_APP_TOKEN || FEISHU_CONFIG.appToken;
  const resp = await fetch(
    `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records/${recordId}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ fields })
    }
  );
  const data = await resp.json();
  return !!data.data?.record;
}
async function bitableDeleteRecord(env, tableId, recordId) {
  bitableCache.delete(tableId);
  const token = await getFeishuToken(env);
  const appToken = env.FEISHU_BITABLE_APP_TOKEN || FEISHU_CONFIG.appToken;
  const resp = await fetch(
    `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records/${recordId}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` }
    }
  );
  const data = await resp.json();
  return data.code === 0;
}
app.get("/api/resumes/my-reviews", authMiddleware, async (c) => {
  const user = c.get("user");
  const result = await c.env.DB.prepare("SELECT * FROM department_reviews WHERE reviewer_id = ? AND is_completed = 0").bind(user.id).all();
  return c.json(result.results.map(transformRow));
});
app.get("/api/interviews", authMiddleware, async (c) => {
  const user = c.get("user");
  let sql = `SELECT 
    i.*,
    r.candidate_name AS _candidate_name,
    p.title AS _position_title
  FROM interviews i
  LEFT JOIN resumes r ON i.resume_id = r.id
  LEFT JOIN positions p ON i.position_id = p.id`;
  const binds = [];
  const conditions = [];
  if (user?.role === "interviewer") {
    conditions.push("i.interviewer_id = ?");
    binds.push(user.id);
  }
  if (user?.role !== "admin" && user?.full_name) {
    conditions.push("p.responsible_person = ?");
    binds.push(user.full_name);
  }
  const status = c.req.query("status");
  if (status) {
    conditions.push("i.status = ?");
    binds.push(status);
  }
  const name = c.req.query("name");
  if (name) {
    conditions.push("i.interviewer LIKE ?");
    binds.push(`%${name}%`);
  }
  if (conditions.length > 0) {
    sql += " WHERE " + conditions.join(" AND ");
  }
  sql += " ORDER BY i.created_at DESC";
  const { results } = await c.env.DB.prepare(sql).bind(...binds).all();
  return c.json(results.map((row) => ({
    ...transformRow(row),
    resume: { candidate_name: row._candidate_name || row.interviewer || "\u672A\u77E5" },
    position: { title: row._position_title || row.position_id || "\u672A\u77E5\u5C97\u4F4D" }
  })));
});
app.post("/api/positions/sync-from-feishu", authMiddleware, async (c) => {
  try {
    const tableId = getBitableTableId(c.env, "requisition");
    const records = await bitableListRecords(c.env, tableId);
    const synced = /* @__PURE__ */ new Set();
    let created = 0;
    let updated = 0;
    let skipped = 0;
    for (const rec of records) {
      const parsed = parseRequisitionRecord(rec);
      const title = parsed.title;
      if (!title || title === "(\u672A\u547D\u540D\u5C97\u4F4D)" || synced.has(title)) {
        skipped++;
        continue;
      }
      synced.add(title);
      const existing = await c.env.DB.prepare(
        "SELECT id FROM positions WHERE title = ? LIMIT 1"
      ).bind(title).first();
      if (existing) {
        await c.env.DB.prepare(
          `UPDATE positions SET 
            department = ?, department_3rd = ?, location = ?, headcount = ?,
            urgency = ?, status = ?, description = ?, requirements = ?,
            responsible_person = ?, salary_range = ?,
            primary_interviewer = ?, secondary_interviewer = ?,
            capability_dimensions = ?, personalized_requirements = ?,
            updated_at = ?
           WHERE id = ?`
        ).bind(
          parsed.department,
          parsed.department_3rd,
          parsed.location,
          parsed.headcount,
          parsed.urgency,
          parsed.status,
          parsed.description,
          parsed.requirements,
          parsed.responsible_person,
          parsed.salary_range,
          parsed.primary_interviewer,
          parsed.secondary_interviewer,
          parsed.capability_dimensions,
          parsed.personalized_requirements,
          now(),
          existing.id
        ).run();
        updated++;
      } else {
        const id = uuid();
        await c.env.DB.prepare(
          `INSERT INTO positions (id, title, department, department_3rd, location, headcount, 
            urgency, status, description, requirements, responsible_person, salary_range,
            primary_interviewer, secondary_interviewer,
            capability_dimensions, personalized_requirements,
            created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          id,
          title,
          parsed.department,
          parsed.department_3rd,
          parsed.location,
          parsed.headcount,
          parsed.urgency,
          parsed.status,
          parsed.description,
          parsed.requirements,
          parsed.responsible_person,
          parsed.salary_range,
          parsed.primary_interviewer,
          parsed.secondary_interviewer,
          parsed.capability_dimensions,
          parsed.personalized_requirements,
          now(),
          now()
        ).run();
        created++;
      }
    }
    return c.json({
      ok: true,
      message: `\u540C\u6B65\u5B8C\u6210\uFF1A\u65B0\u589E ${created} \u4E2A\u5C97\u4F4D\uFF0C\u66F4\u65B0 ${updated} \u4E2A\uFF0C\u8DF3\u8FC7 ${skipped} \u4E2A`,
      created,
      updated,
      skipped
    });
  } catch (e) {
    console.error(`[PositionSync] \u5931\u8D25: ${e.message}`);
    return c.json({ detail: "\u540C\u6B65\u5931\u8D25: " + e.message }, 500);
  }
});
app.post("/api/requisitions/sync-from-annual", authMiddleware, async (c) => {
  try {
    const srcTableId = c.env.FEISHU_POSITION_TABLE_ID || FEISHU_CONFIG.positionTableId;
    const dstTableId = getBitableTableId(c.env, "requisition");
    const records = await bitableListRecords(c.env, srcTableId);
    const existingRecords = await bitableListRecords(c.env, dstTableId);
    let created = 0;
    let updated = 0;
    let skipped = 0;
    for (const rec of records) {
      const f = rec.fields || {};
      const title = getFirstValue(f["\u62DB\u8058\u5C97\u4F4D"]) || "(\u672A\u547D\u540D\u5C97\u4F4D)";
      if (title === "(\u672A\u547D\u540D\u5C97\u4F4D)") {
        skipped++;
        continue;
      }
      const sourceTag = `[\u5E74\u5EA6\u9700\u6C42:${rec.record_id}]`;
      const existing = existingRecords.find((r) => {
        const note = getFirstValue(r.fields?.["\u8BF4\u660E"]) || "";
        return note.includes(sourceTag);
      });
      const dept2 = f["\u4E8B\u4E1A\u90E8\uFF08\u4E8C\u7EA7\uFF09"];
      const department = defaultIfEmpty(
        Array.isArray(dept2) ? dept2[0] || "" : String(dept2 || ""),
        "\u672A\u77E5"
      );
      const department_3rd = defaultIfEmpty(getFirstValue(f["\u6240\u5C5E\u90E8\u95E8\uFF08\u4E09\u7EA7\uFF09"]), "\u672A\u77E5");
      const headcount = f["\u65B0\u589EHC"] || 1;
      const salaryRange = defaultIfEmpty(getFirstValue(f["\u85AA\u8D44\u8303\u56F4"]), "\u672A\u77E5");
      const requirements = defaultIfEmpty(getFirstValue(f["\u5C97\u4F4D\u804C\u8D23\u548C\u4EFB\u804C\u8981\u6C42"]), "\u65E0");
      const personalizedReq = defaultIfEmpty(getFirstValue(f["\u4E2A\u6027\u5316\u9700\u6C42"]), "");
      const urgencyVal = getFirstValue(f["\u7D27\u6025\u5EA6"]) || getFirstValue(f["\u7D27\u6025\u7A0B\u5EA6"]);
      const urgency = urgencyVal ? mapUrgency(urgencyVal) : "medium";
      const capDimsRaw = getFirstValue(f["\u5C97\u4F4D\u80FD\u529B\u7EF4\u5EA6\u5339\u914D"]) || getFirstValue(f["\u5C97\u4F4D\u80FD\u529B\u7EF4\u5EA6\u8981\u6C42"]);
      const city = defaultIfEmpty(getFirstValue(f["\u62DB\u8058\u57CE\u5E02"]), "\u672A\u77E5");
      const cityTier = defaultIfEmpty(getFirstValue(f["\u57CE\u5E02\u7B49\u7EA7"]), "\u672A\u77E5");
      const inBudget = defaultIfEmpty(getFirstValue(f["\u662F\u5426\u5728\u7F16\u5236\u5185"]), "");
      const notesParts = [sourceTag];
      if (personalizedReq) notesParts.push("\u4E2A\u6027\u5316\u9700\u6C42: " + personalizedReq);
      if (salaryRange && salaryRange !== "\u672A\u77E5") notesParts.push("\u85AA\u8D44\u8303\u56F4: " + salaryRange);
      const fields = {};
      fields["\u62DB\u8058\u5C97\u4F4D"] = title;
      fields["\u4E8C\u7EA7\u90E8\u95E8"] = department;
      fields["\u4E09\u7EA7\u90E8\u95E8"] = department_3rd;
      fields["\u62DB\u8058\u72B6\u6001"] = "\u62DB\u8058\u4E2D";
      fields["\u8BF4\u660E"] = notesParts.join("\n");
      const hcNum = typeof headcount === "number" ? headcount : parseInt(String(headcount)) || 1;
      if (hcNum > 0) fields["\u62DB\u8058\u4EBA\u6570"] = hcNum;
      if (requirements && requirements !== "\u65E0") {
        fields["\u62DB\u8058JD"] = requirements;
        fields["\u5C97\u4F4D\u804C\u8D23\u4E0E\u4EFB\u804C\u8981\u6C42"] = requirements;
      }
      if (urgency) fields["\u7D27\u6025\u5EA6"] = urgency;
      if (capDimsRaw) fields["\u5C97\u4F4D\u80FD\u529B\u7EF4\u5EA6\u8981\u6C42"] = capDimsRaw;
      if (city && city !== "\u672A\u77E5") fields["\u62DB\u8058\u57CE\u5E02"] = city;
      if (cityTier && cityTier !== "\u672A\u77E5") fields["\u57CE\u5E02\u7B49\u7EA7"] = cityTier;
      if (inBudget) fields["\u662F\u5426\u5728\u7F16\u5236\u5185"] = inBudget;
      if (personalizedReq) fields["\u62DB\u8058\u7406\u7531"] = personalizedReq;
      if (existing) {
        await bitableUpdateRecord(c.env, dstTableId, existing.record_id, fields);
        updated++;
      } else {
        await bitableCreateRecord(c.env, dstTableId, fields);
        created++;
      }
    }
    return c.json({
      ok: true,
      message: `\u5E74\u5EA6\u9700\u6C42\u540C\u6B65\u5B8C\u6210\uFF1A\u65B0\u589E ${created} \u6761\uFF0C\u66F4\u65B0 ${updated} \u6761\uFF0C\u8DF3\u8FC7 ${skipped} \u6761`,
      created,
      updated,
      skipped
    });
  } catch (e) {
    console.error(`[AnnualReqSync] \u5931\u8D25: ${e.message}`);
    return c.json({ detail: "\u540C\u6B65\u5931\u8D25: " + e.message }, 500);
  }
});
app.get("/api/interviews/pipeline-candidates", authMiddleware, async (c) => {
  try {
    const search = c.req.query("search") || "";
    let sql = "SELECT id, candidate_name, parsed_data, position_id, status, created_at FROM resumes WHERE status = 'approved'";
    const params = [];
    if (search) {
      sql += " AND candidate_name LIKE ?";
      params.push(`%${search}%`);
    }
    sql += " ORDER BY created_at DESC";
    const { results: resumeRows } = await c.env.DB.prepare(sql).bind(...params).all();
    const { results: interviewRows } = await c.env.DB.prepare(
      "SELECT * FROM interviews ORDER BY created_at DESC"
    ).all();
    const interviewMap = /* @__PURE__ */ new Map();
    for (const iv of interviewRows || []) {
      const keys = [iv.resume_id, iv.comments, iv.interviewer].filter(Boolean);
      for (const k of keys) interviewMap.set(k, iv);
    }
    const result = (resumeRows || []).map((row) => {
      let parsed = {};
      try {
        parsed = JSON.parse(row.parsed_data || "{}");
      } catch {
      }
      const matchedIv = interviewMap.get(row.id) || interviewMap.get(row.candidate_name) || (interviewRows || []).find((iv) => iv.comments === row.candidate_name || iv.resume_id === row.id);
      return {
        id: row.id,
        candidate_name: row.candidate_name || "\u672A\u77E5",
        position_applied: parsed.position_applied || "",
        mapped_position: parsed.mapped_position || "",
        standard_position: parsed.mapped_position || parsed.position_applied || "",
        education: parsed.education || row.major || "",
        city: parsed.city || "",
        status: "approved",
        feishu_record_id: row.id || "",
        resume_id: row.id || "",
        create_time: row.created_at || null,
        biz_owner: parsed.biz_owner || "",
        interview_id: matchedIv?.id || null,
        interview_status: matchedIv?.status || "",
        interview_time: matchedIv?.interview_time || "",
        interview_location: matchedIv?.interview_location || "",
        result: matchedIv?.result || "",
        result2: matchedIv?.result2 || "",
        evaluation: matchedIv?.evaluation || "",
        evaluation2: matchedIv?.evaluation2 || "",
        interviewer: matchedIv?.interviewer || "",
        primary_interviewer: matchedIv?.primary_interviewer || "",
        secondary_interviewer: matchedIv?.secondary_interviewer || ""
      };
    });
    return c.json(result);
  } catch (e) {
    console.error(`[PipelineCandidates] \u9519\u8BEF: ${e.message}`);
    return c.json({ detail: "\u83B7\u53D6\u9762\u8BD5\u6D41\u6C34\u7EBF\u6570\u636E\u5931\u8D25: " + e.message }, 500);
  }
});
registerCrud("positions", "positions", { title: "like", status: "eq", department: "like" });
registerCrud("interviews", "interviews", { position_id: "eq", status: "eq" });
registerCrud("background-checks", "background_checks", { status: "eq" });
registerCrud("onboarding", "onboarding_records", { status: "eq" });
registerCrud("probation", "probation_records", { status: "eq", result: "eq" });
registerCrud("workflows", "workflows", { status: "eq" });
registerCrud("workflow-nodes", "workflow_nodes", { workflow_id: "eq" });
registerCrud("workflow-edges", "workflow_edges", { workflow_id: "eq" });
registerCrud("workflow-executions", "workflow_executions", { workflow_id: "eq", status: "eq" });
app.get("/api/requisitions", authMiddleware, async (c) => {
  try {
    const tableId = getBitableTableId(c.env, "requisition");
    const records = await bitableListRecords(c.env, tableId);
    const items = records.map(parseRequisitionRecord);
    const statusFilter = c.req.query("status");
    const deptFilter = c.req.query("department");
    let filtered = items;
    if (statusFilter) filtered = filtered.filter((i) => i.status === statusFilter);
    if (deptFilter) filtered = filtered.filter((i) => i.department?.includes(deptFilter));
    const currentUser = c.get("user");
    if (currentUser?.role !== "admin" && currentUser?.full_name) {
      filtered = filtered.filter((i) => i.responsible_person === currentUser.full_name);
    }
    return c.json(filtered);
  } catch (e) {
    console.error(`[Bitable] \u9700\u6C42\u5217\u8868\u5931\u8D25: ${e.message}`);
    return c.json({ detail: "\u8BFB\u53D6\u98DE\u4E66\u6570\u636E\u5931\u8D25: " + e.message }, 500);
  }
});
app.get("/api/requisitions/:id", authMiddleware, async (c) => {
  try {
    const tableId = getBitableTableId(c.env, "requisition");
    const record = await bitableGetRecord(c.env, tableId, c.req.param("id"));
    if (!record) return c.json({ detail: "Not found" }, 404);
    return c.json(parseRequisitionRecord(record));
  } catch (e) {
    return c.json({ detail: e.message }, 500);
  }
});
app.post("/api/requisitions", authMiddleware, async (c) => {
  try {
    const body = await c.req.json();
    const tableId = getBitableTableId(c.env, "requisition");
    const fields = feishuFieldsToRecord(FEISHU_REQUISITION_FIELDS, body);
    const recordId = await bitableCreateRecord(c.env, tableId, fields);
    if (!recordId) return c.json({ detail: "Create failed" }, 500);
    const record = await bitableGetRecord(c.env, tableId, recordId);
    return c.json(parseRequisitionRecord(record));
  } catch (e) {
    return c.json({ detail: "\u521B\u5EFA\u9700\u6C42\u5931\u8D25: " + e.message }, 500);
  }
});
app.put("/api/requisitions/:id", authMiddleware, async (c) => {
  try {
    const body = await c.req.json();
    const tableId = getBitableTableId(c.env, "requisition");
    const fields = feishuFieldsToRecord(FEISHU_REQUISITION_FIELDS, body);
    await bitableUpdateRecord(c.env, tableId, c.req.param("id"), fields);
    const record = await bitableGetRecord(c.env, tableId, c.req.param("id"));
    return c.json(parseRequisitionRecord(record));
  } catch (e) {
    return c.json({ detail: "\u66F4\u65B0\u5931\u8D25: " + e.message }, 500);
  }
});
app.delete("/api/requisitions/:id", authMiddleware, async (c) => {
  try {
    const tableId = getBitableTableId(c.env, "requisition");
    await bitableDeleteRecord(c.env, tableId, c.req.param("id"));
    return c.json({ detail: "Deleted" });
  } catch (e) {
    return c.json({ detail: "\u5220\u9664\u5931\u8D25: " + e.message }, 500);
  }
});
app.post("/api/interviews/:id/evaluate", authMiddleware, async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const { evaluation, result, round } = body;
    if (!evaluation && !result) {
      return c.json({ detail: "\u8BF7\u586B\u5199\u8BC4\u4EF7\u6216\u9009\u62E9\u7ED3\u679C" }, 400);
    }
    const r = round === 2 ? 2 : 1;
    if (r === 1) {
      const updates = ["status = ?"];
      const binds = ["completed"];
      if (evaluation) {
        updates.push("evaluation = ?");
        binds.push(evaluation);
      }
      if (result) {
        updates.push("result = ?");
        binds.push(result);
      }
      binds.push(id);
      await c.env.DB.prepare(
        `UPDATE interviews SET ${updates.join(", ")} WHERE id = ?`
      ).bind(...binds).run();
    } else {
      const updates = ["status2 = ?"];
      const binds = ["completed"];
      if (evaluation) {
        updates.push("evaluation2 = ?");
        binds.push(evaluation);
      }
      if (result) {
        updates.push("result2 = ?");
        binds.push(result);
      }
      binds.push(id);
      await c.env.DB.prepare(
        `UPDATE interviews SET ${updates.join(", ")} WHERE id = ?`
      ).bind(...binds).run();
    }
    return c.json({ ok: true, detail: `\u7B2C${r}\u9762\u8BC4\u4EF7\u5DF2\u63D0\u4EA4` });
  } catch (e) {
    return c.json({ detail: "\u63D0\u4EA4\u5931\u8D25: " + e.message }, 500);
  }
});
app.post("/api/interviews/create-from-talent", authMiddleware, async (c) => {
  try {
    const body = await c.req.json();
    const { candidate_name, position_applied, city, feishu_record_id, interviewer_name } = body;
    const currentUser = c.get("user");
    if (!candidate_name) {
      return c.json({ detail: "\u7F3A\u5C11\u5019\u9009\u4EBA\u4FE1\u606F" }, 400);
    }
    let interviewerOpenIds = [];
    let interviewerNames = [];
    let matchedReqRecordId = null;
    let matchedReqTitle = "";
    if (interviewer_name) {
      interviewerNames.push(interviewer_name);
      const openId = await getInterviewerOpenId(c.env, interviewer_name);
      if (openId) interviewerOpenIds.push(openId);
    }
    if (!interviewer_name) {
      const requisitionTableId = getBitableTableId(c.env, "requisition");
      const reqs = await bitableListRecords(c.env, requisitionTableId);
      const matchedReq = reqs.find((r) => {
        const f = r.fields || {};
        const status = getFirstValue(f["\u62DB\u8058\u72B6\u6001"]) || "";
        if (status !== "\u62DB\u8058\u4E2D") return false;
        const posName = getFirstValue(f["\u62DB\u8058\u5C97\u4F4D"]) || "";
        const reqCity = getFirstValue(f["\u62DB\u8058\u57CE\u5E02"]) || "";
        return posName === position_applied && (!city || !reqCity || reqCity === city);
      }) || reqs.find((r) => {
        const f = r.fields || {};
        const status = getFirstValue(f["\u62DB\u8058\u72B6\u6001"]) || "";
        if (status !== "\u62DB\u8058\u4E2D") return false;
        const posName = getFirstValue(f["\u62DB\u8058\u5C97\u4F4D"]) || "";
        const reqCity = getFirstValue(f["\u62DB\u8058\u57CE\u5E02"]) || "";
        return posName && position_applied && position_applied.includes(posName) && (!city || !reqCity || reqCity === city);
      });
      if (matchedReq) {
        const mf = matchedReq.fields || {};
        matchedReqRecordId = matchedReq.record_id;
        matchedReqTitle = getFirstValue(mf["\u62DB\u8058\u5C97\u4F4D"]) || "";
        const rawBiz = mf["\u4E1A\u52A1\u4E00\u9762"];
        const bizUsers = extractFeishuUsers(rawBiz);
        for (const u of bizUsers) {
          if (u.open_id && !interviewerOpenIds.includes(u.open_id)) {
            interviewerOpenIds.push(u.open_id);
            interviewerNames.push(u.name || "\u9762\u8BD5\u5B98");
          }
        }
        if (bizUsers.length === 0) {
          const bizName = getUserName(rawBiz);
          if (bizName) interviewerNames.push(bizName);
          const openId = await getInterviewerOpenId(c.env, bizName);
          if (openId && !interviewerOpenIds.includes(openId)) {
            interviewerOpenIds.push(openId);
          }
        }
      }
      let pendingCandidates2 = [];
      if (matchedReqRecordId) {
        try {
          const talentTableId = getBitableTableId(c.env, "talent");
          const allTalent = await bitableListRecords(c.env, talentTableId);
          const mf = matchedReq.fields || {};
          const matchDept2 = getFirstValue(mf["\u4E8C\u7EA7\u90E8\u95E8"]) || "";
          const matchDept3 = getFirstValue(mf["\u4E09\u7EA7\u90E8\u95E8"]) || "";
          const matchPos = getFirstValue(mf["\u62DB\u8058\u5C97\u4F4D"]) || "";
          const matchCity = getFirstValue(mf["\u62DB\u8058\u57CE\u5E02"]) || "";
          for (const t of allTalent) {
            const tf = t.fields || {};
            const tName = getFirstValue(tf["\u59D3\u540D"]) || "";
            if (!tName) continue;
            if (tName === candidate_name) continue;
            const bizReview = getFirstValue(tf["\u4E1A\u52A1\u590D\u6838\u7ED3\u679C"]) || "";
            if (bizReview !== "\u901A\u8FC7") continue;
            const interviewAdvice = getFirstValue(tf["\u4E00\u9762\u5EFA\u8BAE"]) || "";
            if (interviewAdvice && interviewAdvice.trim() !== "") continue;
            const tPos = getFirstValue(tf["\u9762\u8BD5\u5C97\u4F4D"]) || getFirstValue(tf["\u62DB\u8058\u5C97\u4F4D"]) || "";
            if (tPos && matchPos && tPos !== matchPos) continue;
            const tCity = getFirstValue(tf["\u57CE\u5E02"]) || "";
            if (tCity && matchCity && tCity !== matchCity) continue;
            pendingCandidates2.push(tName);
          }
        } catch (e) {
          console.error(`\u67E5\u627E\u5F85\u9762\u8BD5\u5019\u9009\u4EBA\u5931\u8D25: ${e.message}`);
        }
      }
    }
    const interviewId = crypto.randomUUID();
    const interviewerStr = interviewerNames.length > 0 ? interviewerNames.join(", ") : "\u5F85\u5206\u914D";
    let primaryInterviewer = "";
    let secondaryInterviewer = "";
    if (position_applied) {
      try {
        const posRow = await c.env.DB.prepare(
          "SELECT primary_interviewer, secondary_interviewer FROM positions WHERE title = ? LIMIT 1"
        ).bind(position_applied).first();
        if (posRow) {
          primaryInterviewer = posRow.primary_interviewer || "";
          secondaryInterviewer = posRow.secondary_interviewer || "";
        }
      } catch {
      }
    }
    await c.env.DB.prepare(
      `INSERT INTO interviews (id, resume_id, interviewer, position_id, status, created_at, comments, primary_interviewer, secondary_interviewer)
       VALUES (?, ?, ?, ?, 'scheduled', datetime('now'), ?, ?, ?)`
    ).bind(interviewId, feishu_record_id || "", candidate_name, position_applied || "", interviewerStr, primaryInterviewer, secondaryInterviewer).run();
    const notificationResults = [];
    if (interviewerOpenIds.length > 0) {
      try {
        const operatorName = currentUser?.name || currentUser?.email || "\u7CFB\u7EDF\u7BA1\u7406\u5458";
        let preferredToken;
        if (currentUser?.email) {
          const meRow = await c.env.DB.prepare(
            "SELECT feishu_token FROM users WHERE email = ? AND feishu_token IS NOT NULL AND feishu_token != ''"
          ).bind(currentUser.email).first();
          if (meRow?.feishu_token) preferredToken = meRow.feishu_token;
        }
        for (const openId of interviewerOpenIds) {
          const cardElements = [
            { tag: "div", text: { tag: "lark_md", content: `**\u5019\u9009\u4EBA\uFF1A** ${candidate_name}
**\u9762\u8BD5\u5C97\u4F4D\uFF1A** ${matchedReqTitle || position_applied || "\u672A\u6307\u5B9A"}` } },
            { tag: "hr" }
          ];
          if (pendingCandidates.length > 0) {
            cardElements.push({
              tag: "div",
              text: { tag: "lark_md", content: `**\u540C\u5C97\u4F4D\u5F85\u9762\u8BD5\u5019\u9009\u4EBA\uFF1A**
${pendingCandidates.map((n, i) => `${i + 1}. ${n}`).join("\n")}` }
            });
            cardElements.push({ tag: "hr" });
          }
          cardElements.push(
            { tag: "div", text: { tag: "lark_md", content: `${operatorName} \u4E3A\u4F60\u5B89\u6392\u4E86\u9762\u8BD5\uFF0C\u8BF7\u53CA\u65F6\u67E5\u770B\u5019\u9009\u4EBA\u7B80\u5386\uFF0C\u9762\u8BD5\u7ED3\u675F\u540E\u5728\u7CFB\u7EDF\u5185\u586B\u5199\u8BC4\u4EF7\u3002` } },
            { tag: "action", actions: [{ tag: "button", text: { tag: "plain_text", content: "\u{1F50D} \u67E5\u770B\u5019\u9009\u4EBA" }, type: "primary", url: `https://ai-interview-22u.pages.dev/interviews` }] },
            { tag: "note", elements: [{ tag: "plain_text", content: `${operatorName} | AI \u667A\u80FD\u9762\u8BD5\u7CFB\u7EDF` }] }
          );
          const cardContent = {
            config: { wide_screen_mode: true },
            header: { title: { tag: "plain_text", content: `\u{1F3AF} \u9762\u8BD5\u5B89\u6392\u901A\u77E5` }, template: "blue" },
            elements: cardElements
          };
          try {
            await sendFeishuMessageWithFallback(c.env, openId, cardContent, preferredToken);
            notificationResults.push(`\u2705 ${openId} \u53D1\u9001\u6210\u529F`);
          } catch (e) {
            notificationResults.push(`\u274C ${openId} \u53D1\u9001\u5931\u8D25: ${e.message}`);
          }
        }
      } catch (e) {
        notificationResults.push(`\u274C \u901A\u77E5\u5F02\u5E38: ${e.message}`);
      }
    } else {
      notificationResults.push("\u26A0\uFE0F \u672A\u627E\u5230\u5339\u914D\u9762\u8BD5\u5B98\uFF0C\u672A\u53D1\u9001\u901A\u77E5");
    }
    const row = await c.env.DB.prepare("SELECT * FROM interviews WHERE id = ?").bind(interviewId).first();
    return c.json({
      ...row,
      resume: { candidate_name },
      position: { title: position_applied || "\u672A\u77E5\u5C97\u4F4D" },
      interviewer_list: interviewerNames,
      _notification: notificationResults
    });
  } catch (e) {
    return c.json({ detail: "\u521B\u5EFA\u9762\u8BD5\u5931\u8D25: " + e.message }, 500);
  }
});
app.post("/api/resumes", authMiddleware, async (c) => {
  try {
    const formData = await c.req.formData();
    const file = formData.get("file");
    const positionId = formData.get("position_id");
    if (!file || !file.name) {
      return c.json({ detail: "\u8BF7\u4E0A\u4F20\u7B80\u5386\u6587\u4EF6" }, 400);
    }
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      return c.json({ detail: "\u4EC5\u652F\u6301 PDF \u683C\u5F0F" }, 400);
    }
    const fileBuffer = await file.arrayBuffer();
    const fileSize = file.size;
    const fileBase64 = bufToB64(fileBuffer);
    const fileId = "file_" + crypto.randomUUID();
    const tableId = getBitableTableId(c.env, "talent");
    const fields = {};
    const fileNameWithoutExt = file.name.replace(/\.pdf$/i, "");
    fields["\u59D3\u540D"] = fileNameWithoutExt;
    if (positionId) {
      try {
        const origin = new URL(c.req.url).origin;
        const posResp = await fetch(
          `${origin}/api/positions/${positionId}`,
          { headers: { Authorization: c.req.header("Authorization") || "" } }
        );
        if (posResp.ok) {
          const posData = await posResp.json();
          if (posData?.title) {
            fields["\u9762\u8BD5\u5C97\u4F4D"] = posData.title;
          }
        }
      } catch {
      }
    }
    const recordId = await bitableCreateRecord(c.env, tableId, fields);
    if (!recordId) {
      return c.json({ detail: "\u521B\u5EFA\u98DE\u4E66\u8BB0\u5F55\u5931\u8D25" }, 500);
    }
    try {
      await c.env.DB.prepare(
        `INSERT OR REPLACE INTO resume_files (id, kv_key, file_name, file_size, content, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))`
      ).bind(recordId, fileId, file.name, fileSize, fileBase64).run();
    } catch (e) {
      return c.json({ detail: "\u4FDD\u5B58\u6587\u4EF6\u5931\u8D25: " + e.message }, 500);
    }
    let parsedName = fileNameWithoutExt;
    let parsedGender = "";
    let parsedAge = null;
    let parsedEducation = "";
    let parsedCity = "";
    let parsedAdvantage = "";
    let parsedRisk = "";
    let parsedEval = "";
    let parsedPhone = "";
    let parsedEmail = "";
    let parsedSkills = [];
    let parsedWorkYears = null;
    let parsedExperience = "";
    try {
      let pdfText = formData.get("pdf_text")?.toString().trim() || "";
      let extractedText = pdfText || "";
      if (!extractedText || extractedText.length < 20) {
        console.log("[Upload] \u524D\u7AEF\u672A\u4F20 pdf_text\uFF0C\u8D70 AI base64 \u63D0\u53D6\u515C\u5E95");
        const extractionPrompt = `\u4F60\u662F\u4E00\u4E2APDF\u7B80\u5386\u6587\u672C\u63D0\u53D6\u52A9\u624B\u3002\u4E0B\u9762\u662F\u4E00\u4EFDPDF\u7B80\u5386\u7684base64\u7F16\u7801\u6570\u636E\u3002\u8BF7\u4ED4\u7EC6\u9605\u8BFB\u5185\u5BB9\uFF0C\u5C06\u5176\u8F6C\u6362\u4E3A\u7ED3\u6784\u5316\u7684Markdown\u6587\u672C\u3002\u4FDD\u7559\u6240\u6709\u53EF\u8BFB\u7684\u4FE1\u606F\uFF1A\u59D3\u540D\u3001\u8054\u7CFB\u65B9\u5F0F\u3001\u5DE5\u4F5C\u7ECF\u5386\u3001\u6559\u80B2\u80CC\u666F\u3001\u6280\u80FD\u3001\u9879\u76EE\u7ECF\u5386\u7B49\u3002\u5982\u679C\u5185\u5BB9\u4E2D\u5305\u542B\u4E71\u7801\u6216\u65E0\u6CD5\u8BC6\u522B\u7684\u5B57\u7B26\uFF0C\u5C3D\u6700\u5927\u52AA\u529B\u63A8\u65AD\u6B63\u786E\u5185\u5BB9\u3002\u76F4\u63A5\u8F93\u51FAMarkdown\u6587\u672C\uFF0C\u4E0D\u8981\u6DFB\u52A0\u4EFB\u4F55\u989D\u5916\u8BF4\u660E\u3002`;
        extractedText = await callAI(
          c.env,
          extractionPrompt,
          `\u4EE5\u4E0B\u662F\u4E00\u4EFDPDF\u7B80\u5386\u7684base64\u7F16\u7801\u6570\u636E\uFF0C\u8BF7\u63D0\u53D6\u5176\u4E2D\u6240\u6709\u53EF\u8BFB\u6587\u672C\u5E76\u8F6C\u4E3AMarkdown\u683C\u5F0F\uFF08\u4FDD\u7559\u6240\u6709\u4FE1\u606F\uFF09\uFF1A

${fileBase64.substring(0, 32e3)}${fileBase64.length > 32e3 ? "\n\n[\u5185\u5BB9\u622A\u65AD]" : ""}`,
          "deepseek-chat"
        );
      }
      if (extractedText && extractedText.length > 20) {
        try {
          await c.env.DB.prepare("UPDATE resumes SET raw_text = ?, updated_at = ? WHERE id = ?").bind(extractedText.substring(0, 5e4), now(), recordId).run();
        } catch {
        }
      }
      const customPrompt = await getCustomPrompt(c.env, "parse_resume_pdf");
      let systemPrompt, userPrompt;
      if (customPrompt) {
        let sp = customPrompt.system;
        let up = customPrompt.user;
        if (sp.includes("{candidate_name}")) sp = sp.replace(/\{candidate_name\}/g, fileNameWithoutExt);
        if (up.includes("{candidate_name}")) up = up.replace(/\{candidate_name\}/g, fileNameWithoutExt);
        if (up.includes("{resume_text}")) up = up.replace(/\{resume_text\}/g, extractedText || "");
        systemPrompt = sp;
        userPrompt = up;
      } else {
        systemPrompt = `\u4F60\u662F\u4E00\u4E2A\u4E13\u4E1A\u7684\u7B80\u5386\u89E3\u6790\u52A9\u624B\u3002\u8BF7\u4ECE\u7B80\u5386\u6587\u672C\u4E2D\u63D0\u53D6\u4EE5\u4E0B\u6240\u6709\u4FE1\u606F\uFF0C\u5E76\u7528JSON\u683C\u5F0F\u8FD4\u56DE\uFF08\u4E0D\u8981\u52A0markdown\u4EE3\u7801\u5757\uFF09\u3002\u5C3D\u53EF\u80FD\u63D0\u53D6\u6BCF\u4E2A\u5B57\u6BB5\uFF0C\u627E\u4E0D\u5230\u7684\u5B57\u6BB5\u8BBE\u4E3Anull\u6216\u7A7A\u5B57\u7B26\u4E32\u3002

{
  "name": "\u5019\u9009\u4EBA\u59D3\u540D",
  "gender": "\u6027\u522B\uFF08\u7537/\u5973\uFF09",
  "age": \u5E74\u9F84\u6570\u5B57\u6216null,
  "phone": "\u624B\u673A\u53F7\u7801",
  "email": "\u7535\u5B50\u90AE\u7BB1",
  "education": "\u6700\u9AD8\u5B66\u5386\uFF08\u5982\uFF1A\u672C\u79D1/\u7855\u58EB/\u535A\u58EB\uFF09",
  "school": "\u6BD5\u4E1A\u9662\u6821",
  "major": "\u4E13\u4E1A",
  "city": "\u6240\u5728\u57CE\u5E02",
  "work_years": "\u5DE5\u4F5C\u5E74\u9650\uFF08\u6570\u5B57\uFF09",
  "skills": ["\u6280\u80FD1", "\u6280\u80FD2", "\u6280\u80FD3", "..."],
  "current_company": "\u76EE\u524D/\u6700\u8FD1\u6240\u5728\u516C\u53F8",
  "current_position": "\u76EE\u524D/\u6700\u8FD1\u804C\u4F4D",
  "work_experience_summary": "\u5DE5\u4F5C\u7ECF\u5386\u6458\u8981\uFF08200\u5B57\u4EE5\u5185\uFF0C\u7A81\u51FA\u516C\u53F8\u3001\u804C\u4F4D\u3001\u804C\u8D23\u3001\u4E1A\u7EE9\uFF09",
  "advantage": "\u5019\u9009\u4EBA\u6838\u5FC3\u4F18\u52BF\u5206\u6790\uFF083-5\u4E2A\u4F18\u52BF\uFF0C200\u5B57\u4EE5\u5185\uFF09",
  "risk": "\u5019\u9009\u4EBA\u6F5C\u5728\u98CE\u9669\u70B9\uFF08\u5982\u8DF3\u69FD\u9891\u7E41\u3001\u6280\u80FD\u77ED\u677F\u7B49\uFF0C200\u5B57\u4EE5\u5185\uFF09",
  "evaluation": "\u7EFC\u5408\u8BC4\u4F30\uFF08100\u5B57\u4EE5\u5185\uFF09"
}`;
        userPrompt = `\u4EE5\u4E0B\u662F\u4E00\u4EFD\u7B80\u5386\u7684\u7EAF\u6587\u672C\u5185\u5BB9\uFF0C\u8BF7\u4ECE\u4E2D\u63D0\u53D6\u6240\u6709\u5B57\u6BB5\u4FE1\u606F\uFF1A

${extractedText || "\uFF08AI\u672A\u80FD\u63D0\u53D6\u5230\u6587\u672C\uFF0C\u4EE5\u4E0B\u4E3A\u539F\u59CBbase64\u6570\u636E\uFF09\n" + fileBase64.substring(0, 16e3)}`;
      }
      const aiResp = await callAI(c.env, systemPrompt, userPrompt, "deepseek-chat");
      if (aiResp) {
        const parsed = JSON.parse(extractJSON(aiResp) || "{}");
        parsedName = parsed.name || fileNameWithoutExt;
        parsedGender = parsed.gender || "";
        parsedAge = parsed.age || null;
        parsedEducation = parsed.education || "";
        parsedCity = parsed.city || "";
        parsedAdvantage = parsed.advantage || "";
        parsedRisk = parsed.risk || "";
        parsedEval = parsed.evaluation || "";
        parsedPhone = parsed.phone || "";
        parsedEmail = parsed.email || "";
        parsedSkills = Array.isArray(parsed.skills) ? parsed.skills : [];
        parsedWorkYears = parsed.work_years || null;
        parsedExperience = parsed.work_experience_summary || "";
      }
    } catch (aiErr) {
      console.error(`[Upload] AI parsing failed: ${aiErr.message}`);
    }
    try {
      const updateFields = {};
      if (parsedName && parsedName !== fileNameWithoutExt) updateFields["\u59D3\u540D"] = parsedName;
      if (parsedGender) updateFields["\u6027\u522B"] = parsedGender;
      if (parsedAge) updateFields["\u5E74\u9F84"] = parsedAge;
      if (parsedEducation) updateFields["\u5B66\u5386"] = parsedEducation;
      if (parsedCity) updateFields["\u57CE\u5E02"] = parsedCity;
      if (parsedAdvantage) updateFields["\u4F18\u52BF\u5206\u6790"] = parsedAdvantage;
      if (parsedRisk) updateFields["\u98CE\u9669\u70B9"] = parsedRisk;
      if (parsedEval) updateFields["AI\u7B80\u5386\u8BC4\u4F30"] = parsedEval;
      if (parsedPhone) updateFields["\u624B\u673A"] = parsedPhone;
      if (parsedEmail) updateFields["\u90AE\u7BB1"] = parsedEmail;
      if (parsedWorkYears) updateFields["\u5DE5\u4F5C\u5E74\u9650"] = parsedWorkYears;
      if (parsedSkills.length > 0) updateFields["\u6280\u80FD"] = parsedSkills.join(", ");
      if (parsedExperience) updateFields["\u5DE5\u4F5C\u7ECF\u5386"] = parsedExperience;
      await bitableUpdateRecord(c.env, tableId, recordId, updateFields);
    } catch (updateErr) {
      console.error(`[Upload] Failed to update bitable with AI data: ${updateErr.message}`);
    }
    const record = await bitableGetRecord(c.env, tableId, recordId);
    if (!record) {
      return c.json({ detail: "\u8BB0\u5F55\u5DF2\u521B\u5EFA\u4F46\u83B7\u53D6\u8BE6\u60C5\u5931\u8D25" }, 500);
    }
    return c.json(parseTalentRecord(record));
  } catch (e) {
    return c.json({ detail: "\u4E0A\u4F20\u7B80\u5386\u5931\u8D25: " + e.message }, 500);
  }
});
app.get("/api/resumes", authMiddleware, async (c) => {
  try {
    const tableId = getBitableTableId(c.env, "talent");
    const records = await bitableListRecords(c.env, tableId);
    let items = records.map(parseTalentRecord);
    try {
      const extras = await c.env.DB.prepare("SELECT * FROM resume_extras").all();
      const extraMap = new Map((extras.results || []).map((r) => [r.feishu_record_id, r]));
      items = items.map((item) => {
        const extra = extraMap.get(item.id);
        if (extra) {
          if (extra.major && !item.major) item.major = extra.major;
          if (extra.gender && !item.gender) item.gender = extra.gender;
          if (extra.education && !item.education) item.education = extra.education;
          if (extra.age && !item.age) item.age = extra.age;
        }
        return item;
      });
    } catch {
    }
    try {
      const map = await buildPositionMapping(c.env.DB);
      items = items.map((item) => {
        item.standard_position = item.position_applied && map.has(item.position_applied) ? map.get(item.position_applied) : item.position_applied || "";
        return item;
      });
    } catch {
    }
    const nameFilter = c.req.query("candidate_name");
    const statusFilter = c.req.query("status");
    const responsiblePerson = c.req.query("responsible_person");
    let filtered = items;
    if (nameFilter) filtered = filtered.filter((i) => i.candidate_name?.includes(nameFilter));
    if (statusFilter) filtered = filtered.filter((i) => i.status === statusFilter);
    if (responsiblePerson) {
      try {
        const mapRows = await c.env.DB.prepare(
          "SELECT mapped_name FROM position_mappings WHERE responsible_person = ?"
        ).bind(responsiblePerson).all();
        const personPositions = new Set((mapRows.results || []).map((r) => r.mapped_name.trim().toLowerCase()));
        const posRows = await c.env.DB.prepare(
          "SELECT title FROM positions WHERE responsible_person = ?"
        ).bind(responsiblePerson).all();
        for (const r of posRows.results || []) personPositions.add(r.title.trim().toLowerCase());
        filtered = filtered.filter((i) => {
          const pos = (i.mapped_position || i.position_applied || "").trim().toLowerCase();
          return personPositions.has(pos);
        });
      } catch {
      }
    }
    return c.json(filtered);
  } catch (e) {
    console.error(`[Bitable] \u7B80\u5386\u5217\u8868\u5931\u8D25: ${e.message}`);
    return c.json({ detail: "\u8BFB\u53D6\u98DE\u4E66\u6570\u636E\u5931\u8D25: " + e.message }, 500);
  }
});
app.get("/api/resumes/:id", authMiddleware, async (c) => {
  try {
    const tableId = getBitableTableId(c.env, "talent");
    const record = await bitableGetRecord(c.env, tableId, c.req.param("id"));
    if (!record) return c.json({ detail: "Not found" }, 404);
    const item = parseTalentRecord(record);
    try {
      const map = await buildPositionMapping(c.env.DB);
      if (item.position_applied && map.has(item.position_applied)) {
        item.standard_position = map.get(item.position_applied);
      } else {
        item.standard_position = item.position_applied || "";
      }
    } catch {
      item.standard_position = item.position_applied || "";
    }
    return c.json(item);
  } catch (e) {
    return c.json({ detail: e.message }, 500);
  }
});
app.get("/api/resumes/:id/file", async (c) => {
  try {
    const auth = c.req.header("Authorization") || "";
    const queryToken = c.req.query("token") || "";
    let token = "";
    const match2 = auth.match(/^Bearer\s+(.+)$/i);
    if (match2) {
      token = match2[1];
    } else if (queryToken) {
      token = queryToken;
    }
    if (!token) return c.json({ detail: "Not authenticated" }, 401);
    const payload = await verifyJwt(c.env.SECRET_KEY, token);
    if (!payload) return c.json({ detail: "Invalid token" }, 401);
    const tableId = getBitableTableId(c.env, "talent");
    const record = await bitableGetRecord(c.env, tableId, c.req.param("id"));
    if (!record) return c.json({ detail: "Not found" }, 404);
    const f = record.fields || {};
    const recordId = c.req.param("id");
    const isDownload = c.req.query("download") === "true";
    let candidateName = f["\u59D3\u540D"] || "resume";
    let attachmentFileName = candidateName + ".pdf";
    if (recordId) {
      try {
        const fileRow = await c.env.DB.prepare("SELECT content, file_name FROM resume_files WHERE id = ?").bind(recordId).first();
        if (fileRow && fileRow.content) {
          const pdfBytes = b64ToBuf(fileRow.content);
          const disposition = isDownload ? "attachment" : "inline";
          return new Response(pdfBytes, {
            status: 200,
            headers: {
              "Content-Type": "application/pdf",
              "Content-Disposition": `${disposition}; filename="${fileRow.file_name || attachmentFileName}"`,
              "Access-Control-Allow-Origin": "*"
            }
          });
        }
      } catch {
      }
    }
    let fileToken = "";
    let feishuDownloadUrl = "";
    for (const [fieldName, fieldValue] of Object.entries(f)) {
      if (Array.isArray(fieldValue) && fieldValue.length > 0) {
        const item = fieldValue[0];
        if (item && typeof item === "object" && item.file_token) {
          fileToken = item.file_token;
          if (item.tmp_url) feishuDownloadUrl = item.tmp_url;
          break;
        }
        if (item && typeof item === "object" && item.link && item.link.includes("/download/all/")) {
          const linkMatch = item.link.match(/\/download\/all\/([^\/\?]+)/);
          if (linkMatch) {
            fileToken = linkMatch[1];
            feishuDownloadUrl = item.link;
            break;
          }
        }
      }
    }
    if (fileToken && !feishuDownloadUrl) {
      const feishuHost = c.env.FEISHU_HOST || "ywwlaii6ga7";
      const mountToken = c.env.FEISHU_BASE_TOKEN || "NVh9bDiNRaF0ZysxjeLc5ID2n9c";
      feishuDownloadUrl = `https://${feishuHost}.feishu.cn/space/api/box/stream/download/all/${fileToken}?mount_node_token=${mountToken}&mount_point=bitable`;
    }
    if (fileToken) {
      const dlResp = await downloadFeishuAttachment(c.env, fileToken, feishuDownloadUrl);
      if (dlResp) {
        const disposition = isDownload ? "attachment" : "inline";
        return new Response(dlResp.body, {
          status: 200,
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `${disposition}; filename="${attachmentFileName}"`,
            "Access-Control-Allow-Origin": "*"
          }
        });
      }
      console.log(`[ResumeFile] downloadFeishuAttachment returned null for ${recordId}`);
    }
    const fallbackLink = feishuDownloadUrl || (fileToken ? `https://ywwlaii6ga7.feishu.cn/space/api/box/stream/download/all/${fileToken}?mount_point=bitable` : "#");
    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{display:flex;align-items:center;justify-content:center;min-height:100vh;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
  .card{background:#fff;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,.08);padding:48px 40px;text-align:center;max-width:400px}
  .icon{font-size:48px;margin-bottom:16px}
  h2{font-size:18px;color:#0f172a;margin-bottom:8px}
  p{font-size:14px;color:#64748b;margin-bottom:24px;line-height:1.6}
  a{display:inline-block;padding:10px 28px;background:#6366f1;color:#fff;border-radius:8px;text-decoration:none;font-size:14px;font-weight:500;transition:background .2s}
  a:hover{background:#4f46e5}
</style></head>
<body>
<div class="card">
  <div class="icon">\u{1F4C4}</div>
  <h2>\u65E0\u6CD5\u5728\u7EBF\u9884\u89C8 [V2]</h2>
  <p>\u8BE5\u7B80\u5386\u6587\u4EF6\u6258\u7BA1\u5728\u98DE\u4E66\u5E73\u53F0\uFF0C\u9700\u8981\u767B\u5F55\u98DE\u4E66\u8D26\u53F7\u540E\u624D\u80FD\u67E5\u770B\u3002</p>
  <a href="${fallbackLink}" target="_blank">\u5728\u98DE\u4E66\u4E2D\u6253\u5F00</a>
</div>
</body></html>`;
    return new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Access-Control-Allow-Origin": "*"
      }
    });
  } catch (e) {
    return c.json({ detail: "\u4E0B\u8F7D\u7B80\u5386\u6587\u4EF6\u5931\u8D25: " + e.message }, 500);
  }
});
app.post("/api/resumes/cache-files", authMiddleware, async (c) => {
  try {
    const tableId = getBitableTableId(c.env, "talent");
    const records = await bitableListRecords(c.env, tableId);
    let cached = 0;
    let skipped = 0;
    let failed = 0;
    for (const record of records) {
      const rid = record.record_id;
      const f = record.fields || {};
      const existing = await c.env.DB.prepare("SELECT id FROM resume_files WHERE id = ?").bind(rid).first().catch(() => null);
      if (existing) {
        skipped++;
        continue;
      }
      let fileToken = "";
      let tmpUrl = "";
      for (const [fieldName, fieldValue] of Object.entries(f)) {
        if (Array.isArray(fieldValue) && fieldValue.length > 0) {
          const item = fieldValue[0];
          if (item && typeof item === "object") {
            if (item.file_token) {
              fileToken = item.file_token;
              tmpUrl = item.tmp_url || "";
              break;
            }
            if (item.link && item.link.includes("/download/all/")) {
              const linkMatch = item.link.match(/\/download\/all\/([^\/\?]+)/);
              if (linkMatch) {
                fileToken = linkMatch[1];
                tmpUrl = item.link;
                break;
              }
            }
          }
        }
      }
      if (!fileToken) {
        failed++;
        continue;
      }
      const resp = await downloadFeishuAttachment(c.env, fileToken, tmpUrl);
      if (resp) {
        const blob = await resp.clone().arrayBuffer();
        const b64 = bufToB64(blob);
        const candidateName = f["\u59D3\u540D"] || "resume";
        await c.env.DB.prepare(
          "INSERT OR REPLACE INTO resume_files (id, kv_key, file_name, file_size, content, created_at) VALUES (?, ?, ?, ?, ?, ?)"
        ).bind(rid, "cache_" + fileToken, candidateName + ".pdf", blob.byteLength, b64, (/* @__PURE__ */ new Date()).toISOString()).run();
        cached++;
      } else {
        failed++;
      }
    }
    return c.json({ total: records.length, cached, skipped, failed });
  } catch (e) {
    return c.json({ detail: "\u6279\u91CF\u7F13\u5B58\u5931\u8D25: " + e.message }, 500);
  }
});
app.post("/api/resumes/:id/cache-file", async (c) => {
  try {
    const auth = c.req.header("Authorization") || "";
    const queryToken = c.req.query("token") || "";
    const adminSecret = c.req.query("secret") || "";
    let authorized = false;
    if (auth || queryToken) {
      const token = auth.match(/^Bearer\s+(.+)$/i)?.[1] || queryToken;
      if (token) {
        const payload = await verifyJwt(c.env.SECRET_KEY, token);
        if (payload) authorized = true;
      }
    }
    if (!authorized && adminSecret && adminSecret === c.env.SECRET_KEY) {
      authorized = true;
    }
    if (!authorized) return c.json({ detail: "Not authenticated" }, 401);
    const id = c.req.param("id");
    let ab;
    let candidateName;
    const contentType = c.req.header("Content-Type") || "";
    if (contentType.includes("json")) {
      const body = await c.req.json();
      if (!body.file_b64) return c.json({ detail: "\u8BF7\u63D0\u4F9B file_b64" }, 400);
      const bin = b64ToBuf(body.file_b64);
      ab = bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength);
      candidateName = body.name || "resume";
    } else {
      const formData = await c.req.formData();
      const file = formData.get("file");
      if (!file) return c.json({ detail: "\u8BF7\u4E0A\u4F20 PDF \u6587\u4EF6" }, 400);
      ab = await file.arrayBuffer();
      candidateName = formData.get("name")?.toString() || file.name.replace(/\.pdf$/i, "");
    }
    const header = new Uint8Array(ab.slice(0, 5));
    const pdfHeader = new TextDecoder().decode(header);
    if (pdfHeader !== "%PDF-") {
      return c.json({ detail: "\u4E0D\u662F\u6709\u6548\u7684 PDF \u6587\u4EF6" }, 400);
    }
    const b64 = bufToB64(ab);
    await c.env.DB.prepare(
      "INSERT OR REPLACE INTO resume_files (id, kv_key, file_name, file_size, content, created_at) VALUES (?, ?, ?, ?, ?, ?)"
    ).bind(id, "browser_cache_" + id, candidateName + ".pdf", ab.byteLength, b64, (/* @__PURE__ */ new Date()).toISOString()).run();
    return c.json({ success: true, file_size: ab.byteLength });
  } catch (e) {
    return c.json({ detail: "\u7F13\u5B58\u5931\u8D25: " + (e.message || e) }, 500);
  }
});
app.get("/api/resumes/:id/file-info", authMiddleware, async (c) => {
  try {
    const tableId = getBitableTableId(c.env, "talent");
    const record = await bitableGetRecord(c.env, tableId, c.req.param("id"));
    if (!record) return c.json({ detail: "Not found" }, 404);
    const f = record.fields || {};
    let fileToken = "";
    let feishuUrl = "";
    let candidateName = f["\u59D3\u540D"] || "resume";
    for (const [fieldName, fieldValue] of Object.entries(f)) {
      if (Array.isArray(fieldValue) && fieldValue.length > 0) {
        const item = fieldValue[0];
        if (item && typeof item === "object") {
          if (item.file_token) {
            fileToken = item.file_token;
            if (item.tmp_url) feishuUrl = item.tmp_url;
            break;
          }
          if (item.link && item.link.includes("/download/all/")) {
            const linkMatch = item.link.match(/\/download\/all\/([^\/\?]+)/);
            if (linkMatch) {
              fileToken = linkMatch[1];
              feishuUrl = item.link;
              break;
            }
          }
        }
      }
    }
    if (!fileToken) return c.json({ detail: "\u672A\u627E\u5230\u9644\u4EF6" }, 404);
    if (!feishuUrl) {
      const feishuHost = c.env.FEISHU_HOST || "ywwlaii6ga7";
      const mountToken = c.env.FEISHU_BASE_TOKEN || "NVh9bDiNRaF0ZysxjeLc5ID2n9c";
      feishuUrl = `https://${feishuHost}.feishu.cn/space/api/box/stream/download/all/${fileToken}?mount_node_token=${mountToken}&mount_point=bitable`;
    }
    return c.json({ fileToken, feishuUrl, candidateName });
  } catch (e) {
    return c.json({ detail: e.message }, 500);
  }
});
app.post("/api/resumes/clear-all-except", authMiddleware, async (c) => {
  try {
    const body = await c.req.json();
    const keepIds = body.keep_ids || [];
    const tableId = getBitableTableId(c.env, "talent");
    const records = await bitableListRecords(c.env, tableId);
    const toDelete = records.filter((r) => !keepIds.includes(r.record_id));
    let deleted = 0;
    for (const r of toDelete) {
      await bitableDeleteRecord(c.env, tableId, r.record_id);
      deleted++;
    }
    return c.json({ deleted, total_before: records.length, kept: keepIds.length });
  } catch (e) {
    return c.json({ detail: "\u6E05\u9664\u5931\u8D25: " + e.message }, 500);
  }
});
app.delete("/api/resumes/:id", authMiddleware, async (c) => {
  try {
    const tableId = getBitableTableId(c.env, "talent");
    await bitableDeleteRecord(c.env, tableId, c.req.param("id"));
    return c.json({ detail: "Deleted" });
  } catch (e) {
    return c.json({ detail: "\u5220\u9664\u5931\u8D25: " + e.message }, 500);
  }
});
app.post("/api/resumes/import-from-feishu", authMiddleware, async (c) => {
  try {
    const tableId = getBitableTableId(c.env, "talent");
    const records = await bitableListRecords(c.env, tableId);
    let imported = 0, skipped = 0, failed = 0, pdfCached = 0, pdfFailed = 0;
    const errors = [];
    try {
      await c.env.DB.prepare(
        "CREATE TABLE IF NOT EXISTS feishu_sync (record_id TEXT PRIMARY KEY, candidate_name TEXT, position_applied TEXT, created_at TEXT DEFAULT (datetime('now')))"
      ).run();
    } catch {
    }
    for (const rec of records) {
      const rid = rec.record_id;
      const f = rec.fields || {};
      const candidateName = getFirstValue(f["\u59D3\u540D"]) || "";
      if (!candidateName || !rid) {
        skipped++;
        continue;
      }
      const existing = await c.env.DB.prepare("SELECT record_id FROM feishu_sync WHERE record_id = ?").bind(rid).first().catch(() => null);
      if (existing) {
        skipped++;
        continue;
      }
      try {
        const resumeId = rid;
        const positionApplied = defaultIfEmpty(getFirstValue(f["\u9762\u8BD5\u5C97\u4F4D"]) || getFirstValue(f["\u62DB\u8058\u5C97\u4F4D"]), "\u672A\u77E5");
        const gender = defaultIfEmpty(getFirstValue(f["\u6027\u522B"]), "\u672A\u77E5");
        const age = f["\u5E74\u9F84"] ? String(f["\u5E74\u9F84"]) : "";
        const education = defaultIfEmpty(getFirstValue(f["\u5B66\u5386"]), "\u672A\u77E5");
        const city = defaultIfEmpty(getFirstValue(f["\u57CE\u5E02"]), "\u672A\u77E5");
        const aiEval = getFirstValue(f["AI\u7B80\u5386\u8BC4\u4F30"]) || "";
        const hrResult = getFirstValue(f["HR\u590D\u6838\u7ED3\u679C"]) || "";
        const advantage = getFirstValue(f["\u4F18\u52BF\u5206\u6790"]) || "";
        const risk = getFirstValue(f["\u98CE\u9669\u70B9"]) || "";
        const screeningResult = defaultIfEmpty(getFirstValue(f["AI\u7B80\u5386\u521D\u7B5B\u7ED3\u679C"]), "\u5F85\u521D\u7B5B");
        const mappedPosition = defaultIfEmpty(getFirstValue(f["\u62DB\u8058\u5C97\u4F4D\u5339\u914D"]), "\u65E0");
        const bizReview = defaultIfEmpty(getFirstValue(f["\u4E1A\u52A1\u590D\u6838\u7ED3\u679C"]), "\u5F85\u590D\u6838");
        const bizOwner = defaultIfEmpty(getFirstValue(f["\u4E1A\u52A1\u8D1F\u8D23\u4EBA"]), "\u5F85\u5206\u914D");
        const interviewSuggestion = defaultIfEmpty(getFirstValue(f["\u4E00\u9762\u5EFA\u8BAE"]), "\u65E0");
        const interviewQuestions = defaultIfEmpty(getFirstValue(f["\u9762\u8BD5\u95EE\u9898\u5EFA\u8BAE"]), "\u65E0");
        const notes = getFirstValue(f["\u5907\u6CE8-\u624B\u52A8"]) || "";
        const reserveType = defaultIfEmpty(getFirstValue(f["\u50A8\u5907\u4EBA\u624D\u7C7B\u578B-\u624B\u52A8"]), "\u672A\u77E5");
        const capDimMatch = getFirstValue(f["\u5C97\u4F4D\u80FD\u529B\u7EF4\u5EA6\u5339\u914D"]) || "";
        const parsedData = {
          gender,
          age,
          education,
          city,
          position_applied: positionApplied,
          mapped_position: mappedPosition,
          screening_result: screeningResult,
          advantage,
          risk,
          capability_dimension_match: capDimMatch,
          interview_suggestion: interviewSuggestion,
          interview_questions: interviewQuestions,
          notes,
          reserve_type: reserveType,
          hr_review: hrResult,
          biz_review: bizReview,
          biz_owner: bizOwner,
          hr_pass_date: f["HR\u521D\u7B5B\u901A\u8FC7\u65E5\u671F"] || null,
          create_time: f["\u521B\u5EFA\u65F6\u95F4"] || null,
          source_id: getFirstValue(f["SourceID"]) || ""
        };
        const ts = now();
        try {
          await c.env.DB.prepare(
            `INSERT OR REPLACE INTO resumes (id, candidate_name, email, status, ai_review, hr_review, raw_text, created_at, parsed_data, match_score, screening_result)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
          ).bind(
            resumeId,
            candidateName,
            getFirstValue(f["SourceID"]) || "",
            mapHrReviewToStatus(hrResult || ""),
            aiEval,
            hrResult,
            advantage + "\n" + risk,
            ts,
            JSON.stringify(parsedData),
            extractScoreFromEval(aiEval),
            screeningResult || "pending"
          ).run();
        } catch (e) {
          console.error(`[FeishuImport] resume insert failed for ${candidateName}: ${e.message}`);
        }
        await c.env.DB.prepare(
          "INSERT OR REPLACE INTO feishu_sync (record_id, candidate_name, position_applied, created_at) VALUES (?, ?, ?, ?)"
        ).bind(rid, candidateName, positionApplied, ts).run();
        imported++;
        try {
          let fileToken = "", tmpUrl = "";
          for (const [fieldName, fieldValue] of Object.entries(f)) {
            if (Array.isArray(fieldValue) && fieldValue.length > 0) {
              const item = fieldValue[0];
              if (item && typeof item === "object" && item.file_token) {
                fileToken = item.file_token;
                tmpUrl = item.tmp_url || "";
                break;
              }
              if (item && typeof item === "object" && item.link && item.link.includes("/download/all/")) {
                const linkMatch = item.link.match(/\/download\/all\/([^\/\?]+)/);
                if (linkMatch) {
                  fileToken = linkMatch[1];
                  tmpUrl = item.link;
                  break;
                }
              }
            }
          }
          if (fileToken) {
            const existingFile = await c.env.DB.prepare("SELECT id FROM resume_files WHERE id = ?").bind(rid).first().catch(() => null);
            if (!existingFile) {
              const resp = await downloadFeishuAttachment(c.env, fileToken, tmpUrl);
              if (resp) {
                const blob = await resp.clone().arrayBuffer();
                const b64 = bufToB64(blob);
                await c.env.DB.prepare(
                  "INSERT OR REPLACE INTO resume_files (id, kv_key, file_name, file_size, content, created_at) VALUES (?, ?, ?, ?, ?, ?)"
                ).bind(rid, "import_" + fileToken, candidateName + ".pdf", blob.byteLength, b64, ts).run();
                pdfCached++;
              } else {
                pdfFailed++;
              }
            }
          }
        } catch (e) {
          pdfFailed++;
          console.error(`[FeishuImport] PDF cache failed for ${candidateName}: ${e.message}`);
        }
      } catch (e) {
        failed++;
        errors.push(`${candidateName}: ${e.message?.substring(0, 80)}`);
      }
    }
    return c.json({
      total: records.length,
      imported,
      skipped,
      failed,
      pdf_cached: pdfCached,
      pdf_failed: pdfFailed,
      errors: errors.length > 0 ? errors : void 0
    });
  } catch (e) {
    return c.json({ detail: "\u98DE\u4E66\u5BFC\u5165\u5931\u8D25: " + e.message }, 500);
  }
});
app.post("/api/resumes/clear-rejected", authMiddleware, async (c) => {
  try {
    const tableId = getBitableTableId(c.env, "talent");
    const records = await bitableListRecords(c.env, tableId);
    const rejected = records.filter((r) => {
      const hrResult = r.fields?.["HR\u590D\u6838\u7ED3\u679C"];
      return hrResult === "\u672A\u901A\u8FC7";
    });
    let deleted = 0;
    for (const r of rejected) {
      await bitableDeleteRecord(c.env, tableId, r.record_id);
      deleted++;
    }
    return c.json({ deleted });
  } catch (e) {
    return c.json({ detail: "\u6E05\u9664\u5931\u8D25: " + e.message }, 500);
  }
});
app.get("/api/debug/feishu-download", authMiddleware, async (c) => {
  try {
    const tableId = getBitableTableId(c.env, "talent");
    const records = await bitableListRecords(c.env, tableId);
    const first = records[0];
    if (!first) return c.json({ detail: "No records" }, 404);
    const f = first.fields || {};
    const fieldKeys = Object.keys(f);
    let fileToken = "";
    let tmpUrl = "";
    let foundField = "";
    for (const [fieldName, fieldValue] of Object.entries(f)) {
      if (Array.isArray(fieldValue) && fieldValue.length > 0) {
        const item = fieldValue[0];
        if (item && typeof item === "object") {
          if (item.file_token) {
            fileToken = item.file_token;
            tmpUrl = item.tmp_url || "";
            foundField = fieldName;
            break;
          }
          if (item.link && item.link.includes("/download/all/")) {
            const linkMatch = item.link.match(/\/download\/all\/([^\/\?]+)/);
            if (linkMatch) {
              fileToken = linkMatch[1];
              tmpUrl = item.link;
              foundField = fieldName;
              break;
            }
          }
        }
      }
    }
    const logs = [];
    logs.push({ step: "scan_fields", recordId: first.record_id, fieldKeys: fieldKeys.length, foundField, fileToken, found: !!fileToken });
    if (!fileToken) {
      const sampleValues = {};
      for (const k of fieldKeys.slice(0, 10)) {
        sampleValues[k] = typeof f[k] === "object" ? JSON.stringify(f[k]).substring(0, 100) : String(f[k]).substring(0, 100);
      }
      logs.push({ sampleValues });
      return c.json({ logs });
    }
    const token = await getFeishuToken(c.env);
    logs.push({ step: "got_token", tokenPrefix: token?.substring(0, 10) });
    if (tmpUrl) {
      const resp = await fetch(tmpUrl, {
        headers: { "User-Agent": "Mozilla/5.0" },
        redirect: "follow"
      });
      logs.push({ step: "method_A_tmpUrl", status: resp.status, ct: resp.headers.get("Content-Type") });
      if (!resp.ok) {
        const body = await resp.text().catch(() => "");
        logs.push({ step: "method_A_body", body: body.substring(0, 200) });
      }
    }
    const postResp = await fetch(
      `https://open.feishu.cn/open-apis/drive/v1/medias/${fileToken}/download`,
      { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: "{}", redirect: "follow" }
    );
    const postStatus = postResp.status;
    let postBodyPreview = "";
    try {
      postBodyPreview = await postResp.clone().text().then((t) => t.substring(0, 500));
    } catch (e) {
    }
    logs.push({ step: "method_B_drive_post", status: postStatus, body: postBodyPreview });
    const boxUrl = `https://ywwlaii6ga7.feishu.cn/space/api/box/stream/download/all/${fileToken}?mount_node_token=NVh9bDiNRaF0ZysxjeLc5ID2n9c&mount_point=bitable`;
    const boxResp = await fetch(boxUrl, {
      headers: { Authorization: `Bearer ${token}`, "User-Agent": "Mozilla/5.0", "Referer": "https://ywwlaii6ga7.feishu.cn/" },
      redirect: "follow"
    });
    logs.push({ step: "method_C_box", status: boxResp.status, ct: boxResp.headers.get("Content-Type") });
    const batchUrl = `https://open.feishu.cn/open-apis/drive/v1/medias/batch_get_tmp_download_url?file_tokens=${fileToken}`;
    const batchResp = await fetch(batchUrl, {
      headers: { Authorization: `Bearer ${token}` },
      redirect: "follow"
    });
    let batchBody = "";
    try {
      batchBody = await batchResp.clone().text().then((t) => t.substring(0, 1e3));
    } catch (e) {
    }
    logs.push({ step: "method_D_batch", status: batchResp.status, body: batchBody });
    return c.json({ recordId: first.record_id, fileToken, logs });
  } catch (e) {
    return c.json({ detail: e.message, stack: e.stack }, 500);
  }
});
app.post("/api/resumes/batch", authMiddleware, async (c) => {
  const body = await c.req.json();
  const results = [];
  for (const item of body.items || body || []) {
    const id = uuid();
    const cols = ["id", "created_at"];
    const vals = [id, now()];
    for (const [k, v] of Object.entries(item)) {
      if (validCol(k) && !["id", "created_at"].includes(k)) {
        cols.push(k);
        vals.push(prepareValue(v));
      }
    }
    const placeholders = cols.map(() => "?").join(", ");
    await c.env.DB.prepare(`INSERT INTO resumes (${cols.join(", ")}) VALUES (${placeholders})`).bind(...vals).run();
    results.push(id);
  }
  return c.json({ created: results.length, ids: results });
});
app.post("/api/resumes/:id/reparse", authMiddleware, async (c) => {
  const id = c.req.param("id");
  const resume = await c.env.DB.prepare("SELECT * FROM resumes WHERE id = ?").bind(id).first();
  if (!resume) return c.json({ detail: "Resume not found" }, 404);
  const rawText = resume.raw_text || resume.resume_markdown || "";
  if (!rawText) return c.json({ detail: "No text to parse" }, 400);
  const candidateName = resume.candidate_name || resume.parsed_name || "";
  const customPrompt = await getCustomPrompt(c.env, "analyze_resume");
  let systemPrompt, userPrompt;
  if (customPrompt) {
    let sp = customPrompt.system;
    let up = customPrompt.user;
    if (sp.includes("{candidate_name}")) sp = sp.replace(/\{candidate_name\}/g, candidateName);
    if (up.includes("{candidate_name}")) up = up.replace(/\{candidate_name\}/g, candidateName);
    if (up.includes("{resume_text}")) up = up.replace(/\{resume_text\}/g, rawText);
    if (sp.includes("{resume_text}")) sp = sp.replace(/\{resume_text\}/g, rawText);
    systemPrompt = sp;
    userPrompt = up;
  } else {
    systemPrompt = `\u4F60\u662F\u4E00\u4F4D\u8D44\u6DF1\u62DB\u8058\u4E13\u5BB6\u548C\u7B80\u5386\u89E3\u6790\u52A9\u624B\u3002\u8BF7\u89E3\u6790\u4EE5\u4E0B\u7B80\u5386\u6587\u672C\uFF0C\u63D0\u53D6\u5B8C\u6574\u4FE1\u606F\u5E76\u8FDB\u884CAI\u521D\u7B5B\u8BC4\u4F30\u3002\u8FD4\u56DEJSON\u683C\u5F0F\uFF08\u4E0D\u8981\u52A0markdown\u4EE3\u7801\u5757\uFF09\uFF0C\u5305\u542B\u4E24\u90E8\u5206\uFF1A

\u7B2C\u4E00\u90E8\u5206 - \u57FA\u7840\u4FE1\u606F\uFF1A
- candidate_name: \u5019\u9009\u4EBA\u59D3\u540D\uFF08\u5168\u540D\uFF09
- gender: \u6027\u522B\uFF08\u7537/\u5973\uFF09
- age: \u5E74\u9F84\uFF08\u6570\u5B57\uFF09
- phone: \u624B\u673A\u53F7\u7801
- email: \u7535\u5B50\u90AE\u7BB1
- highest_degree: \u6700\u9AD8\u5B66\u5386
- school: \u6BD5\u4E1A\u9662\u6821
- major: \u4E13\u4E1A
- graduation_year: \u6BD5\u4E1A\u5E74\u4EFD
- years_of_experience: \u5DE5\u4F5C\u5E74\u9650\uFF08\u6570\u5B57\uFF09
- current_company: \u76EE\u524D/\u6700\u8FD1\u6240\u5728\u516C\u53F8
- current_position: \u76EE\u524D/\u6700\u8FD1\u804C\u4F4D
- salary_expectation: \u671F\u671B\u85AA\u8D44\uFF08\u5982\u679C\u6709\uFF09
- skills: \u6280\u80FD\u5217\u8868\uFF08\u6570\u7EC4\uFF09
- certifications: \u8BC1\u4E66/\u8D44\u8D28\uFF08\u6570\u7EC4\uFF09
- work_experience: \u5DE5\u4F5C\u7ECF\u5386\u6570\u7EC4\uFF0C\u6BCF\u4E2A\u5305\u542B { company, title, duration, description, achievements }
- education: \u6559\u80B2\u7ECF\u5386\u6570\u7EC4\uFF0C\u6BCF\u4E2A\u5305\u542B { school, degree, major, duration }

\u7B2C\u4E8C\u90E8\u5206 - AI\u521D\u7B5B\u8BC4\u4F30\uFF1A
- position: \u5E94\u8058\u5C97\u4F4D\uFF08\u4ECE\u6587\u4EF6\u540D\u6216\u6587\u672C\u4E2D\u63D0\u53D6\uFF09
- advantage (\u4F18\u52BF\u5206\u6790): \u7528\u4E2D\u6587\u63CF\u8FF03-5\u4E2A\u6838\u5FC3\u4F18\u52BF
- risk (\u98CE\u9669\u70B9/\u52A3\u52BF\u5206\u6790): \u7528\u4E2D\u6587\u63CF\u8FF02-4\u4E2A\u52A3\u52BF\u6216\u98CE\u9669
- match_score: \u4EBA\u5C97\u5339\u914D\u5EA6\uFF080-100\u7684\u6574\u6570\uFF09
- recommendation: \u63A8\u8350\u5EFA\u8BAE\uFF08"strongly_recommend"/"recommend"/"neutral"/"not_recommend"/"strongly_not_recommend"\uFF09
- summary: \u7EFC\u5408\u5206\u6790\u6458\u8981\uFF08\u4E2D\u6587\uFF0C2-3\u53E5\u8BDD\uFF09
- suggested_questions: \u5EFA\u8BAE\u9762\u8BD5\u95EE\u9898\uFF08\u4E2D\u6587\uFF0C3-5\u4E2A\uFF09`;
    userPrompt = "\u7B80\u5386\u6587\u672C\uFF08\u8BF7\u63D0\u53D6\u5B8C\u6574\u4FE1\u606F\uFF09\uFF1A\n" + rawText;
  }
  try {
    const result = await callAI(c.env, systemPrompt, userPrompt);
    let parsed;
    try {
      parsed = extractJSON(result);
    } catch {
      parsed = { raw_response: result };
    }
    const flattened = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === "object" && v !== null && !Array.isArray(v)) {
        Object.assign(flattened, v);
      } else {
        flattened[k] = v;
      }
    }
    const merged = { ...parsed, ...flattened };
    const advantage = merged.advantage || merged.advantages || "";
    const risk = merged.risk || merged.risks || "";
    const pos = merged.position || "";
    const matchScore = typeof merged.match_score === "number" ? merged.match_score : null;
    const recommendation = merged.recommendation || "";
    const recLabel = {
      "strongly_recommend": "\u5F3A\u70C8\u63A8\u8350",
      "recommend": "\u63A8\u8350",
      "neutral": "\u5F85\u5B9A",
      "not_recommend": "\u4E0D\u63A8\u8350",
      "strongly_not_recommend": "\u5F3A\u70C8\u4E0D\u63A8\u8350"
    };
    const aiReview = [
      `\u{1F4CC} \u9762\u8BD5\u5C97\u4F4D\uFF1A${pos}`,
      ``,
      `\u521D\u7B5B\u7ED3\u679C: ${recLabel[recommendation] || recommendation}`,
      matchScore !== null ? `\u5339\u914D\u5206\u6570: ${matchScore}/100` : "",
      ``,
      advantage ? `\u4F18\u52BF\u5206\u6790:
${advantage}` : "",
      risk ? `
\u98CE\u9669\u70B9:
${risk}` : "",
      merged.summary ? `
\u7EFC\u5408\u8BC4\u4F30:
${merged.summary}` : ""
    ].filter(Boolean).join("\n");
    await c.env.DB.prepare(
      "UPDATE resumes SET parsed_data = ?, ai_review = ?, match_score = ?, screening_result = ?, parse_status = ? WHERE id = ?"
    ).bind(
      JSON.stringify(merged),
      aiReview || JSON.stringify(merged),
      matchScore,
      merged.recommendation || JSON.stringify(merged),
      "reparsed",
      id
    ).run();
    try {
      const talentTableId = getBitableTableId(c.env, "talent");
      const advantageStr = advantage;
      const riskStr = risk;
      const recLabelForEval = {
        "strongly_recommend": "\u5F3A\u70C8\u63A8\u8350",
        "recommend": "\u63A8\u8350",
        "neutral": "\u5F85\u5B9A",
        "not_recommend": "\u4E0D\u63A8\u8350",
        "strongly_not_recommend": "\u5F3A\u70C8\u4E0D\u63A8\u8350"
      };
      const evalSummary = [
        merged.summary || "",
        "",
        `\u5339\u914D\u5206\u6570: ${matchScore !== null ? matchScore + "/100" : "-"}`,
        `\u63A8\u8350\u610F\u89C1: ${recLabelForEval[recommendation] || recommendation || "-"}`,
        "",
        advantageStr ? `\u4F18\u52BF:
${advantageStr}` : "",
        riskStr ? `
\u98CE\u9669:
${riskStr}` : ""
      ].filter(Boolean).join("\n");
      await bitableUpdateRecord(c.env, talentTableId, id, {
        "AI\u7B80\u5386\u8BC4\u4F30": evalSummary,
        "\u4F18\u52BF\u5206\u6790": advantageStr,
        "\u98CE\u9669\u70B9": riskStr,
        "AI\u7B80\u5386\u521D\u7B5B\u7ED3\u679C": recommendation || ""
      });
    } catch (e) {
      console.error(`[Reparse] \u540C\u6B65\u5230\u98DE\u4E66\u5931\u8D25: ${e.message}`);
    }
    return c.json({ detail: "Reparse completed", id, parsed_data: merged, ai_review: aiReview });
  } catch (err) {
    return c.json({ detail: "Reparse failed", error: err.message }, 500);
  }
});
app.post("/api/resumes/:id/ai-screen", authMiddleware, async (c) => {
  const id = c.req.param("id");
  const resume = await c.env.DB.prepare("SELECT * FROM resumes WHERE id = ?").bind(id).first();
  if (!resume) return c.json({ detail: "Resume not found" }, 404);
  let position = null;
  if (resume.position_id) {
    position = await c.env.DB.prepare("SELECT * FROM positions WHERE id = ?").bind(resume.position_id).first();
  }
  const resumeText = resume.resume_markdown || resume.raw_text || "";
  const posTitle = position?.title || resume.position_id || "Unknown";
  const posDesc = position?.description || "";
  const posReq = position?.requirements || "";
  const posDept = position?.department || "";
  const posSalary = position?.salary_range || "";
  const systemPrompt = `You are an expert HR recruiter AI. Analyze the candidate resume against the job requirements. Respond in Chinese. Return a JSON object with:
- match_score: integer 0-100
- recommendation: one of "strongly_recommend", "recommend", "neutral", "not_recommend", "strongly_not_recommend"
- summary: brief summary of the candidate (2-3 sentences in Chinese)
- strengths: array of 3-5 key strengths in Chinese
- risks: array of 2-4 potential risks or concerns in Chinese
- skill_match: object with "matched" (array) and "gaps" (array) in Chinese
- suggested_questions: array of 3-5 interview questions in Chinese
- experience_analysis: brief analysis of relevant experience in Chinese (2-3 sentences)`;
  const userPrompt = `Job Position:
Title: ${posTitle}
Department: ${posDept}
Salary: ${posSalary}
Description: ${posDesc}
Requirements: ${posReq}

Candidate Resume:
${resumeText}

Please analyze and return the JSON assessment.`;
  try {
    const result = await callAI(c.env, systemPrompt, userPrompt);
    let parsed;
    try {
      parsed = extractJSON(result);
    } catch {
      parsed = { raw_response: result, summary: result };
    }
    await c.env.DB.prepare(
      "UPDATE resumes SET ai_review = ?, match_score = ?, screening_result = ?, parse_status = ?, updated_at = ? WHERE id = ?"
    ).bind(JSON.stringify(parsed), parsed.match_score || null, JSON.stringify(parsed), "ai_screened", now(), id).run();
    try {
      const talentTableId = getBitableTableId(c.env, "talent");
      const strengths = Array.isArray(parsed.strengths) ? parsed.strengths.join("\n") : parsed.strengths || "";
      const risks = Array.isArray(parsed.risks) ? parsed.risks.join("\n") : parsed.risks || "";
      const aiEval = [
        parsed.summary || "",
        "",
        `\u5339\u914D\u5206\u6570: ${parsed.match_score ?? "-"}/100`,
        `\u63A8\u8350\u610F\u89C1: ${parsed.recommendation || "-"}`,
        "",
        strengths ? `\u4F18\u52BF:
${strengths}` : "",
        risks ? `
\u98CE\u9669:
${risks}` : ""
      ].filter(Boolean).join("\n");
      await bitableUpdateRecord(c.env, talentTableId, id, {
        "AI\u7B80\u5386\u8BC4\u4F30": aiEval,
        "\u4F18\u52BF\u5206\u6790": strengths,
        "\u98CE\u9669\u70B9": risks,
        "AI\u7B80\u5386\u521D\u7B5B\u7ED3\u679C": parsed.recommendation || ""
      });
    } catch (e) {
      console.error(`[AIScreen] \u540C\u6B65\u5230\u98DE\u4E66\u5931\u8D25: ${e.message}`);
    }
    try {
      const existingFile = await c.env.DB.prepare("SELECT id FROM resume_files WHERE id = ?").bind(id).first();
      if (!existingFile) {
        const talentTableId = getBitableTableId(c.env, "talent");
        const record = await bitableGetRecord(c.env, talentTableId, id);
        if (record) {
          const f = record.fields || {};
          for (const [fieldName, fieldValue] of Object.entries(f)) {
            if (Array.isArray(fieldValue) && fieldValue.length > 0) {
              const item = fieldValue[0];
              if (item && typeof item === "object" && (item.file_token || item.link)) {
                const fileToken = item.file_token || "";
                const tmpUrl = item.tmp_url || "";
                const dlUrl = tmpUrl || (fileToken ? `https://ywwlaii6ga7.feishu.cn/space/api/box/stream/download/all/${fileToken}?mount_node_token=${FEISHU_CONFIG.appToken}&mount_point=bitable` : "");
                if (fileToken || tmpUrl) {
                  const dlResp = await downloadFeishuAttachment(c.env, fileToken, dlUrl);
                  if (dlResp) {
                    const blob = await dlResp.arrayBuffer();
                    const b64 = bufToB64(blob);
                    await c.env.DB.prepare(
                      "INSERT OR REPLACE INTO resume_files (id, kv_key, file_name, file_size, content, created_at) VALUES (?, ?, ?, ?, ?, ?)"
                    ).bind(id, "aiscreen_" + (fileToken || "tmp"), (f["\u59D3\u540D"] || "resume") + ".pdf", blob.byteLength, b64, (/* @__PURE__ */ new Date()).toISOString()).run();
                  }
                }
                break;
              }
            }
          }
        }
      }
    } catch (e) {
      console.error(`[AIScreen] \u7F13\u5B58PDF\u5931\u8D25: ${e.message}`);
    }
    return c.json({ success: true, ai_review: parsed });
  } catch (err) {
    return c.json({ detail: "AI screening failed", error: err.message }, 500);
  }
});
app.post("/api/resumes/:id/confirm-rejection", authMiddleware, async (c) => {
  const id = c.req.param("id");
  await c.env.DB.prepare("UPDATE resumes SET status = 'rejected', stage = 'rejected', rejected_at = ? WHERE id = ?").bind(now(), id).run();
  const row = await c.env.DB.prepare("SELECT * FROM resumes WHERE id = ?").bind(id).first();
  return c.json(transformRow(row));
});
app.post("/api/resumes/:id/override-rejection", authMiddleware, async (c) => {
  const id = c.req.param("id");
  await c.env.DB.prepare("UPDATE resumes SET status = 'pending_review', stage = 'screening', rejected_at = NULL WHERE id = ?").bind(id).run();
  const row = await c.env.DB.prepare("SELECT * FROM resumes WHERE id = ?").bind(id).first();
  return c.json(transformRow(row));
});
app.post("/api/resumes/:id/approve-to-talent-pool", authMiddleware, async (c) => {
  const id = c.req.param("id");
  const talentTableId = getBitableTableId(c.env, "talent");
  let record = await bitableGetRecord(c.env, talentTableId, id);
  if (!record) return c.json({ detail: "Candidate not found in Bitable" }, 404);
  await bitableUpdateRecord(c.env, talentTableId, id, { "HR\u590D\u6838\u7ED3\u679C": "\u901A\u8FC7" });
  const now2 = (/* @__PURE__ */ new Date()).toISOString().replace("T", " ").substring(0, 19);
  try {
    const existingResume = await c.env.DB.prepare("SELECT * FROM resumes WHERE id = ?").bind(id).first();
    if (existingResume) {
      await c.env.DB.prepare("UPDATE resumes SET status = 'approved', created_at = ? WHERE id = ?").bind(now2, id).run();
    } else {
      const f = record.fields || {};
      const candidateName = getFirstValue(f["\u59D3\u540D"]) || "\u672A\u77E5";
      const positionApplied = getFirstValue(f["\u9762\u8BD5\u5C97\u4F4D"] || f["\u62DB\u8058\u5C97\u4F4D"]) || "\u672A\u77E5";
      const education = getFirstValue(f["\u5B66\u5386"]) || "";
      const city = getFirstValue(f["\u57CE\u5E02"]) || "";
      const aiEval = getFirstValue(f["AI\u7B80\u5386\u8BC4\u4F30"]) || "";
      const hrResult = getFirstValue(f["HR\u590D\u6838\u7ED3\u679C"]) || "";
      const advantage = getFirstValue(f["\u4F18\u52BF\u5206\u6790"]) || "";
      const risk = getFirstValue(f["\u98CE\u9669\u70B9"]) || "";
      const mappedPosition = getFirstValue(f["\u62DB\u8058\u5C97\u4F4D\u5339\u914D"]) || positionApplied;
      const bizOwner = getFirstValue(f["\u4E1A\u52A1\u8D1F\u8D23\u4EBA"]) || "\u5F85\u5206\u914D";
      const parsedData = {
        position_applied: positionApplied,
        mapped_position: mappedPosition,
        education,
        city,
        advantage,
        risk,
        biz_owner: bizOwner,
        screening_result: "\u5DF2\u5165\u5E93",
        hr_review: hrResult
      };
      await c.env.DB.prepare(
        `INSERT INTO resumes (id, candidate_name, status, hr_review, raw_text, created_at, parsed_data)
         VALUES (?, ?, 'approved', ?, ?, ?, ?)`
      ).bind(id, candidateName, hrResult, advantage + "\n" + risk, now2, JSON.stringify(parsedData)).run();
    }
  } catch (e) {
    console.error(`[ApproveToTalentPool] D1 \u540C\u6B65\u5931\u8D25: ${e.message}`);
  }
  record = await bitableGetRecord(c.env, talentTableId, id);
  return c.json(parseTalentRecord(record));
});
app.post("/api/resumes/:id/reject-from-screening", authMiddleware, async (c) => {
  const id = c.req.param("id");
  const talentTableId = getBitableTableId(c.env, "talent");
  let record = await bitableGetRecord(c.env, talentTableId, id);
  if (!record) return c.json({ detail: "Candidate not found in Bitable" }, 404);
  await bitableUpdateRecord(c.env, talentTableId, id, { "HR\u590D\u6838\u7ED3\u679C": "\u672A\u901A\u8FC7" });
  record = await bitableGetRecord(c.env, talentTableId, id);
  return c.json(parseTalentRecord(record));
});
app.post("/api/resumes/sync-approved-to-d1", authMiddleware, async (c) => {
  try {
    const tableId = getBitableTableId(c.env, "talent");
    const records = await bitableListRecords(c.env, tableId);
    let synced = 0, skipped = 0, failed = 0;
    for (const rec of records) {
      const rid = rec.record_id;
      const f = rec.fields || {};
      const hrResult = getFirstValue(f["HR\u590D\u6838\u7ED3\u679C"]) || "";
      if (hrResult !== "\u901A\u8FC7") {
        skipped++;
        continue;
      }
      try {
        const ts = now();
        const candidateName = getFirstValue(f["\u59D3\u540D"]) || "\u672A\u77E5";
        const positionApplied = getFirstValue(f["\u9762\u8BD5\u5C97\u4F4D"] || f["\u62DB\u8058\u5C97\u4F4D"]) || "\u672A\u77E5";
        const education = getFirstValue(f["\u5B66\u5386"]) || "";
        const city = getFirstValue(f["\u57CE\u5E02"]) || "";
        const aiEval = getFirstValue(f["AI\u7B80\u5386\u8BC4\u4F30"]) || "";
        const hrVal = getFirstValue(f["HR\u590D\u6838\u7ED3\u679C"]) || "";
        const advantage = getFirstValue(f["\u4F18\u52BF\u5206\u6790"]) || "";
        const risk = getFirstValue(f["\u98CE\u9669\u70B9"]) || "";
        const mappedPosition = getFirstValue(f["\u62DB\u8058\u5C97\u4F4D\u5339\u914D"]) || positionApplied;
        const bizOwner = getFirstValue(f["\u4E1A\u52A1\u8D1F\u8D23\u4EBA"]) || "\u5F85\u5206\u914D";
        const parsedData = {
          position_applied: positionApplied,
          mapped_position: mappedPosition,
          education,
          city,
          advantage,
          risk,
          biz_owner: bizOwner,
          screening_result: "\u5DF2\u5165\u5E93",
          hr_review: hrVal
        };
        const existing = await c.env.DB.prepare("SELECT id FROM resumes WHERE id = ?").bind(rid).first();
        if (existing) {
          await c.env.DB.prepare("UPDATE resumes SET status = 'approved', hr_review = ?, created_at = ? WHERE id = ?").bind(hrVal, ts, rid).run();
        } else {
          await c.env.DB.prepare(
            `INSERT INTO resumes (id, candidate_name, status, hr_review, raw_text, created_at, parsed_data)
             VALUES (?, ?, 'approved', ?, ?, ?, ?)`
          ).bind(rid, candidateName, hrVal, advantage + "\n" + risk, ts, JSON.stringify(parsedData)).run();
        }
        synced++;
      } catch (e) {
        failed++;
        console.error(`[SyncApproved] ${getFirstValue(f["\u59D3\u540D"])}: ${e.message}`);
      }
    }
    return c.json({ total: records.length, synced, skipped, failed });
  } catch (e) {
    return c.json({ detail: "\u540C\u6B65\u5931\u8D25: " + e.message }, 500);
  }
});
app.post("/api/resumes/:id/reset-to-pending", authMiddleware, async (c) => {
  const id = c.req.param("id");
  const talentTableId = getBitableTableId(c.env, "talent");
  let record = await bitableGetRecord(c.env, talentTableId, id);
  if (!record) return c.json({ detail: "Candidate not found in Bitable" }, 404);
  await bitableUpdateRecord(c.env, talentTableId, id, { "HR\u590D\u6838\u7ED3\u679C": "" });
  record = await bitableGetRecord(c.env, talentTableId, id);
  return c.json(parseTalentRecord(record));
});
app.get("/api/resumes/:id/department-reviews", authMiddleware, async (c) => {
  const result = await c.env.DB.prepare("SELECT * FROM department_reviews WHERE resume_id = ?").bind(c.req.param("id")).all();
  return c.json(result.results.map(transformRow));
});
app.post("/api/resumes/:id/department-reviews", authMiddleware, async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const body = await c.req.json();
  const reviewId = uuid();
  await c.env.DB.prepare(
    "INSERT INTO department_reviews (id, resume_id, reviewer_id, technical_score, experience_score, overall_score, recommendation, comment, is_completed, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)"
  ).bind(reviewId, id, user.id, body.technical_score, body.experience_score, body.overall_score, body.recommendation, body.comment, now(), now()).run();
  const row = await c.env.DB.prepare("SELECT * FROM department_reviews WHERE id = ?").bind(reviewId).first();
  return c.json(transformRow(row));
});
app.post("/api/resumes/:id/hr-decision", authMiddleware, async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const decision = body.decision || "approve";
  let status = "pending_interview", stage = "interview";
  if (decision === "reject") {
    status = "rejected";
    stage = "rejected";
  }
  await c.env.DB.prepare("UPDATE resumes SET status = ?, stage = ?, hr_review = ? WHERE id = ?").bind(status, stage, body.comment || "", id).run();
  const row = await c.env.DB.prepare("SELECT * FROM resumes WHERE id = ?").bind(id).first();
  return c.json(transformRow(row));
});
app.post("/api/resumes/:id/transfer", authMiddleware, async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  await c.env.DB.prepare("UPDATE resumes SET position_id = ? WHERE id = ?").bind(body.position_id, id).run();
  const row = await c.env.DB.prepare("SELECT * FROM resumes WHERE id = ?").bind(id).first();
  return c.json(transformRow(row));
});
app.get("/api/interviews/:id/questions", authMiddleware, async (c) => {
  const row = await c.env.DB.prepare("SELECT questions FROM interviews WHERE id = ?").bind(c.req.param("id")).first();
  if (!row) return c.json({ detail: "Not found" }, 404);
  let qs = [];
  if (row.questions) {
    try {
      qs = JSON.parse(row.questions);
    } catch {
      qs = [];
    }
  }
  return c.json(qs);
});
app.post("/api/interviews/:id/start", authMiddleware, async (c) => {
  const id = c.req.param("id");
  await c.env.DB.prepare("UPDATE interviews SET status = 'in_progress', started_at = ? WHERE id = ?").bind(now(), id).run();
  const row = await c.env.DB.prepare("SELECT * FROM interviews WHERE id = ?").bind(id).first();
  if (row) {
    c.executionCtx.waitUntil((async () => {
      try {
        const token = await getFeishuToken(c.env);
        const resumeId = row.resume_id;
        let candidateName = "\u672A\u77E5";
        let positionName = "\u672A\u77E5\u5C97\u4F4D";
        if (resumeId) {
          const resume = await c.env.DB.prepare("SELECT * FROM resumes WHERE id = ?").bind(resumeId).first();
          if (resume) {
            candidateName = resume.candidate_name || "\u672A\u77E5";
            const pd = safeJson(resume.parsed_data);
            positionName = pd?.target_position || resume.mapped_position || resume.position_applied || "\u672A\u77E5\u5C97\u4F4D";
          }
        }
        const fakeRecord = { candidate_name: candidateName, mapped_position: positionName, position_applied: positionName };
        await notifyInterviewersForCandidate(c.env, token, fakeRecord);
      } catch (e) {
        console.error(`\u5F00\u59CB\u9762\u8BD5\u901A\u77E5\u5931\u8D25: ${e.message}`);
      }
    })());
  }
  return c.json(transformRow(row));
});
app.post("/api/interviews/:id/cancel", authMiddleware, async (c) => {
  const id = c.req.param("id");
  const interview = await c.env.DB.prepare("SELECT * FROM interviews WHERE id = ?").bind(id).first();
  if (!interview) return c.json({ detail: "Interview not found" }, 404);
  await c.env.DB.prepare("UPDATE interviews SET status = 'cancelled' WHERE id = ?").bind(id).run();
  return c.json({ detail: "\u9762\u8BD5\u5DF2\u53D6\u6D88" });
});
app.post("/api/interviews/:id/score", authMiddleware, async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  await c.env.DB.prepare("UPDATE interviews SET scores = ?, total_score = ?, comments = ?, evaluation = ?, suggestion = ?, status = ? WHERE id = ?").bind(JSON.stringify(body.scores || {}), body.total_score, JSON.stringify(body.comments || {}), body.evaluation || "", body.suggestion || "", body.status || "completed", id).run();
  const row = await c.env.DB.prepare("SELECT * FROM interviews WHERE id = ?").bind(id).first();
  return c.json(transformRow(row));
});
app.post("/api/interviews/:id/confirm", authMiddleware, async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  await c.env.DB.prepare("UPDATE interviews SET result = ?, status = ? WHERE id = ?").bind(body.result || "passed", "completed", id).run();
  const row = await c.env.DB.prepare("SELECT * FROM interviews WHERE id = ?").bind(id).first();
  return c.json(transformRow(row));
});
app.get("/api/interviews/export", authMiddleware, async (c) => {
  return c.json([]);
});
app.post("/api/positions/:id/ai-match", authMiddleware, async (c) => {
  const id = c.req.param("id");
  const position = await c.env.DB.prepare("SELECT * FROM positions WHERE id = ?").bind(id).first();
  if (!position) return c.json({ detail: "Position not found" }, 404);
  const resumes = await c.env.DB.prepare("SELECT id, candidate_name, resume_markdown, raw_text, match_score FROM resumes WHERE position_id = ?").bind(id).all();
  const posInfo = { title: position.title, description: position.description, requirements: position.requirements, department: position.department, salary_range: position.salary_range };
  const systemPrompt = `You are an expert HR matching AI. Given a job position and a list of candidates, rank them by suitability. Respond in Chinese. Return a JSON array of objects with:
- resume_id: the candidate id
- candidate_name: the candidate name
- match_score: integer 0-100
- ranking_reason: brief reason for the ranking in Chinese`;
  const candidateList = resumes.results.map((r) => ({ id: r.id, name: r.candidate_name, resume: (r.resume_markdown || r.raw_text || "").substring(0, 500) }));
  const userPrompt = `Position: ${JSON.stringify(posInfo)}

Candidates:
${JSON.stringify(candidateList, null, 2)}

Rank these candidates by suitability for the position. Return a JSON array.`;
  try {
    const result = await callAI(c.env, systemPrompt, userPrompt, "deepseek-v4-flash");
    let ranking;
    try {
      ranking = extractJSON(result);
      if (!Array.isArray(ranking)) ranking = [ranking];
    } catch {
      ranking = [];
    }
    return c.json({ position_id: id, rankings: ranking });
  } catch (err) {
    return c.json({ detail: "AI matching failed", error: err.message }, 500);
  }
});
function sseBody(content) {
  return `data: ${JSON.stringify({ content })}

data: ${JSON.stringify({ done: true })}

`;
}
app.post("/api/positions/generate-jd-stream", authMiddleware, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const { title, department, location, salary_range } = body;
  if (!title) return c.json({ detail: "position title required" }, 400);
  const systemPrompt = `\u4F60\u662F\u4E00\u540D\u8D44\u6DF1\u62DB\u8058\u4E13\u5BB6\u3002\u6839\u636E\u804C\u4F4D\u4FE1\u606F\u751F\u6210\u4E13\u4E1A\u7684\u804C\u4F4D\u63CF\u8FF0(JD)\u3002\u53EA\u7528\u4E2D\u6587\u56DE\u7B54\u3002\u8FD4\u56DE\u4E25\u683C\u7684 JSON,\u683C\u5F0F\u4E3A {"description": "\u8BE6\u7EC6\u804C\u8D23\u63CF\u8FF0", "requirements": "\u4EFB\u804C\u8981\u6C42,\u591A\u6761\u7528\u6362\u884C\u5206\u9694"}\u3002\u4E0D\u8981\u5305\u542B markdown \u4EE3\u7801\u5757\u6807\u8BB0\u6216\u989D\u5916\u8BF4\u660E\u3002`;
  const userPrompt = `\u804C\u4F4D\u540D\u79F0: ${title}
\u90E8\u95E8: ${department || "\u672A\u6307\u5B9A"}
\u5DE5\u4F5C\u5730\u70B9: ${location || "\u672A\u6307\u5B9A"}
\u85AA\u8D44\u8303\u56F4: ${salary_range || "\u9762\u8BAE"}

\u8BF7\u751F\u6210\u8BE5\u804C\u4F4D\u7684\u8BE6\u7EC6\u804C\u8D23\u63CF\u8FF0\u548C\u4EFB\u804C\u8981\u6C42\u3002`;
  try {
    const result = await callAI(c.env, systemPrompt, userPrompt, "deepseek-v4-flash");
    return new Response(sseBody(result), { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } });
  } catch (err) {
    return new Response(`data: ${JSON.stringify({ error: err.message })}

`, { headers: { "Content-Type": "text/event-stream" } });
  }
});
app.post("/api/positions/chat-jd-stream", authMiddleware, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const messages = body.messages || [];
  const currentDesc = body.current_description || "";
  const currentReq = body.current_requirements || "";
  const userMsgs = messages.filter((m) => m.role === "user").map((m) => m.content).join("\n");
  const systemPrompt = `\u4F60\u662F\u4E00\u540D\u8D44\u6DF1\u62DB\u8058\u4E13\u5BB6,\u6B63\u5728\u5E2E\u7528\u6237\u4FEE\u6539\u804C\u4F4D\u63CF\u8FF0(JD)\u3002\u6839\u636E\u7528\u6237\u53CD\u9988\u4FEE\u6539\u5F53\u524D JD\u3002\u53EA\u7528\u4E2D\u6587\u56DE\u7B54\u3002\u8FD4\u56DE\u4E25\u683C\u7684 JSON: {"description": "\u4FEE\u6539\u540E\u7684\u8BE6\u7EC6\u804C\u8D23\u63CF\u8FF0", "requirements": "\u4FEE\u6539\u540E\u7684\u4EFB\u804C\u8981\u6C42"}\u3002\u4E0D\u8981\u5305\u542B markdown \u4EE3\u7801\u5757\u6807\u8BB0\u6216\u989D\u5916\u8BF4\u660E\u3002`;
  const userPrompt = `\u5F53\u524D\u804C\u4F4D\u63CF\u8FF0:
${currentDesc}

\u5F53\u524D\u4EFB\u804C\u8981\u6C42:
${currentReq}

\u7528\u6237\u4FEE\u6539\u610F\u89C1:
${userMsgs || "\u8BF7\u4F18\u5316\u5B8C\u5584"}

\u8BF7\u636E\u6B64\u4FEE\u6539 JD \u5E76\u8FD4\u56DE\u5B8C\u6574 JSON\u3002`;
  try {
    const result = await callAI(c.env, systemPrompt, userPrompt, "deepseek-v4-flash");
    return new Response(sseBody(result), { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } });
  } catch (err) {
    return new Response(`data: ${JSON.stringify({ error: err.message })}

`, { headers: { "Content-Type": "text/event-stream" } });
  }
});
app.post("/api/interviews/:id/ai-analysis", authMiddleware, async (c) => {
  const id = c.req.param("id");
  const interview = await c.env.DB.prepare("SELECT * FROM interviews WHERE id = ?").bind(id).first();
  if (!interview) return c.json({ detail: "Interview not found" }, 404);
  let resume = null;
  if (interview.resume_id) resume = await c.env.DB.prepare("SELECT id, candidate_name, resume_markdown, raw_text, match_score FROM resumes WHERE id = ?").bind(interview.resume_id).first();
  let position = null;
  if (interview.position_id) position = await c.env.DB.prepare("SELECT title, description, requirements, department FROM positions WHERE id = ?").bind(interview.position_id).first();
  let scores = {};
  let comments = {};
  let questions = [];
  try {
    scores = JSON.parse(interview.scores || "{}");
  } catch {
  }
  try {
    comments = JSON.parse(interview.comments || "{}");
  } catch {
  }
  try {
    questions = JSON.parse(interview.questions || "[]");
  } catch {
  }
  const scoreList = Object.entries(scores).map(([k, v]) => `\u7B2C${Number(k) + 1}\u9898: ${v}\u5206`).join("; ");
  const commentList = Object.entries(comments).map(([k, v]) => `\u7B2C${Number(k) + 1}\u9898\u8BC4\u8BED: ${v}`).join("\n");
  const questionList = questions.map((q, i) => `${i + 1}. ${q.question || q.title || ""} (\u7C7B\u578B:${q.type || "\u672A\u5206\u7C7B"}, \u96BE\u5EA6:${q.difficulty || "\u672A\u77E5"})`).join("\n");
  const scoreValues = Object.values(scores);
  const avg = scoreValues.length > 0 ? (scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length).toFixed(1) : "N/A";
  const systemPrompt = `\u4F60\u662F\u4E00\u540D\u8D44\u6DF1\u62DB\u8058\u9762\u8BD5\u5B98 AI\u3002\u6839\u636E\u9762\u8BD5\u8BC4\u5206\u3001\u9762\u8BD5\u5B98\u8BC4\u8BED\u3001\u9762\u8BD5\u9898\u8868\u73B0\u548C\u5019\u9009\u4EBA\u7B80\u5386,\u751F\u6210\u4E00\u4EFD\u7ED3\u6784\u5316\u7684\u5019\u9009\u4EBA\u9762\u8BD5\u7EFC\u5408\u8BC4\u4F30\u62A5\u544A\u3002\u7528\u4E2D\u6587\u56DE\u7B54,\u4F7F\u7528 Markdown \u683C\u5F0F,\u5305\u542B\u4EE5\u4E0B\u90E8\u5206:## \u7EFC\u5408\u8BC4\u4EF7\u3001## \u5019\u9009\u4EBA\u4F18\u52BF\u3001## \u98CE\u9669\u4E0E\u4E0D\u8DB3\u3001## \u6539\u8FDB\u5EFA\u8BAE\u3001## \u5F55\u7528\u5EFA\u8BAE\u3002\u5728"## \u5F55\u7528\u5EFA\u8BAE"\u90E8\u5206\u7ED9\u51FA\u660E\u786E\u7ED3\u8BBA(\u63A8\u8350\u5F55\u7528/\u5F85\u5B9A/\u4E0D\u63A8\u8350)\u548C\u7B80\u77ED\u7406\u7531\u3002`;
  const userPrompt = `\u5019\u9009\u4EBA: ${resume?.candidate_name || "\u672A\u77E5"}
\u5E94\u8058\u5C97\u4F4D: ${position?.title || "\u672A\u77E5"}
\u5C97\u4F4D\u8981\u6C42: ${position?.requirements || "\u65E0"}
\u5E73\u5747\u5F97\u5206: ${avg}/10

\u9762\u8BD5\u9898:
${questionList || "\u65E0"}

\u8BC4\u5206\u660E\u7EC6: ${scoreList || "\u65E0"}

\u9762\u8BD5\u5B98\u8BC4\u8BED:
${commentList || "\u65E0"}

\u5019\u9009\u4EBA\u7B80\u5386\u6458\u8981:
${(resume?.resume_markdown || resume?.raw_text || "").substring(0, 800)}

\u8BF7\u751F\u6210\u7EFC\u5408\u8BC4\u4F30\u62A5\u544A\u3002`;
  try {
    const evaluation = await callAI(c.env, systemPrompt, userPrompt, "deepseek-v4-flash");
    let suggestion = "";
    const m = evaluation.match(/录用建议[：:]*\s*([^\n]+)/);
    if (m) suggestion = m[1].trim();
    if (!suggestion) suggestion = evaluation.slice(-100).replace(/[#*\n]/g, "").trim();
    await c.env.DB.prepare("UPDATE interviews SET evaluation = ?, suggestion = ?, result = ? WHERE id = ?").bind(evaluation, suggestion, "pending", id).run();
    const row = await c.env.DB.prepare("SELECT * FROM interviews WHERE id = ?").bind(id).first();
    return c.json(transformRow(row));
  } catch (err) {
    return c.json({ detail: "AI analysis failed", error: err.message }, 500);
  }
});
app.post("/api/requisitions/:id/approve", authMiddleware, async (c) => {
  const id = c.req.param("id");
  const user = c.get("user");
  await c.env.DB.prepare("UPDATE job_requisitions SET status = 'approved', approved_by = ?, approved_at = ? WHERE id = ?").bind(user.id, now(), id).run();
  const row = await c.env.DB.prepare("SELECT * FROM job_requisitions WHERE id = ?").bind(id).first();
  return c.json(transformRow(row));
});
app.post("/api/requisitions/:id/reject", authMiddleware, async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  await c.env.DB.prepare("UPDATE job_requisitions SET status = 'rejected', rejection_reason = ? WHERE id = ?").bind(body.reason || "", id).run();
  const row = await c.env.DB.prepare("SELECT * FROM job_requisitions WHERE id = ?").bind(id).first();
  return c.json(transformRow(row));
});
app.post("/api/probation/:id/confirm", authMiddleware, async (c) => {
  const id = c.req.param("id");
  const user = c.get("user");
  const body = await c.req.json().catch(() => ({}));
  await c.env.DB.prepare("UPDATE probation_records SET result = ?, confirmed_at = ?, confirmed_by = ?, new_title = ?, salary_adjustment = ? WHERE id = ?").bind(body.result || "confirmed", now(), user.id, body.new_title || null, body.salary_adjustment || null, id).run();
  const row = await c.env.DB.prepare("SELECT * FROM probation_records WHERE id = ?").bind(id).first();
  return c.json(transformRow(row));
});
app.post("/api/probation/:id/review", authMiddleware, async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const existing = await c.env.DB.prepare("SELECT monthly_reviews FROM probation_records WHERE id = ?").bind(id).first();
  let reviews = [];
  if (existing?.monthly_reviews) {
    try {
      reviews = JSON.parse(existing.monthly_reviews);
    } catch {
      reviews = [];
    }
  }
  reviews.push(body);
  await c.env.DB.prepare("UPDATE probation_records SET monthly_reviews = ? WHERE id = ?").bind(JSON.stringify(reviews), id).run();
  return c.json({ detail: "Review added" });
});
app.post("/api/workflows/:id/publish", authMiddleware, async (c) => {
  const id = c.req.param("id");
  await c.env.DB.prepare("UPDATE workflows SET status = 'published', published_at = ? WHERE id = ?").bind(now(), id).run();
  const row = await c.env.DB.prepare("SELECT * FROM workflows WHERE id = ?").bind(id).first();
  return c.json(transformRow(row));
});
app.post("/api/workflows/:id/execute", authMiddleware, async (c) => {
  const id = c.req.param("id");
  const user = c.get("user");
  const execId = uuid();
  await c.env.DB.prepare(
    "INSERT INTO workflow_executions (id, workflow_id, status, trigger_type, triggered_by, started_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).bind(execId, id, "running", "manual", user.id, now(), now()).run();
  const row = await c.env.DB.prepare("SELECT * FROM workflow_executions WHERE id = ?").bind(execId).first();
  return c.json(transformRow(row));
});
app.get("/api/settings/system", authMiddleware, requireRole(["admin"]), async (c) => {
  const row = await c.env.DB.prepare("SELECT * FROM system_configs ORDER BY updated_at DESC LIMIT 1").first();
  if (!row) return c.json({});
  return c.json(transformRow(row));
});
app.put("/api/settings/system", authMiddleware, requireRole(["admin"]), async (c) => {
  const body = await c.req.json();
  const existing = await c.env.DB.prepare("SELECT id FROM system_configs ORDER BY updated_at DESC LIMIT 1").first();
  if (existing) {
    const cols = [];
    const vals = [];
    for (const [k, v] of Object.entries(body)) {
      if (validCol(k) && !["id", "updated_at"].includes(k)) {
        cols.push(k);
        vals.push(prepareValue(v));
      }
    }
    cols.push("updated_at");
    vals.push(now());
    const setClause = cols.map((k) => `${k} = ?`).join(", ");
    await c.env.DB.prepare(`UPDATE system_configs SET ${setClause} WHERE id = ?`).bind(...vals, existing.id).run();
  } else {
    const id = uuid();
    const cols = ["id", "updated_at"];
    const vals = [id, now()];
    for (const [k, v] of Object.entries(body)) {
      if (validCol(k) && !["id", "updated_at"].includes(k)) {
        cols.push(k);
        vals.push(prepareValue(v));
      }
    }
    const placeholders = cols.map(() => "?").join(", ");
    await c.env.DB.prepare(`INSERT INTO system_configs (${cols.join(", ")}) VALUES (${placeholders})`).bind(...vals).run();
  }
  const row = await c.env.DB.prepare("SELECT * FROM system_configs ORDER BY updated_at DESC LIMIT 1").first();
  return c.json(transformRow(row));
});
app.get("/api/settings/mail", authMiddleware, async (c) => {
  const row = await c.env.DB.prepare("SELECT smtp_host, smtp_port, smtp_username, mail_from, mail_from_name, mail_enabled, frontend_url FROM system_configs ORDER BY updated_at DESC LIMIT 1").first();
  return c.json(transformRow(row) || {});
});
app.put("/api/settings/mail", authMiddleware, async (c) => {
  return c.json({ detail: "Mail settings updated" });
});
app.get("/api/settings/prompts", authMiddleware, async (c) => {
  const row = await c.env.DB.prepare("SELECT prompt_configs FROM system_configs ORDER BY updated_at DESC LIMIT 1").first();
  if (!row?.prompt_configs) return c.json({ prompts: {} });
  try {
    const configs = JSON.parse(row.prompt_configs);
    return c.json(typeof configs.prompts === "object" ? configs : { prompts: configs });
  } catch {
    return c.json({ prompts: {} });
  }
});
app.get("/api/settings/prompts/:key", authMiddleware, async (c) => {
  const row = await c.env.DB.prepare("SELECT prompt_configs FROM system_configs ORDER BY updated_at DESC LIMIT 1").first();
  if (!row?.prompt_configs) return c.json({ detail: "Not found" }, 404);
  try {
    const configs = JSON.parse(row.prompt_configs);
    return c.json(configs[c.req.param("key")] || { detail: "Not found" }, 404);
  } catch {
    return c.json({ detail: "Not found" }, 404);
  }
});
app.get("/api/settings/prompts/variables", authMiddleware, async (c) => {
  const variables_by_prompt = {
    generate_jd: [
      { name: "position_title", description: "\u5C97\u4F4D\u540D\u79F0" },
      { name: "department", description: "\u6240\u5C5E\u90E8\u95E8" },
      { name: "requirements", description: "\u5C97\u4F4D\u8981\u6C42" },
      { name: "salary_range", description: "\u85AA\u8D44\u8303\u56F4" }
    ],
    analyze_resume: [
      { name: "candidate_name", description: "\u5019\u9009\u4EBA\u59D3\u540D" },
      { name: "position", description: "\u5E94\u8058\u5C97\u4F4D" },
      { name: "jd_text", description: "\u5C97\u4F4D\u63CF\u8FF0" },
      { name: "resume_text", description: "\u7B80\u5386\u6587\u672C" }
    ],
    generate_resume_markdown: [
      { name: "candidate_name", description: "\u5019\u9009\u4EBA\u59D3\u540D" },
      { name: "resume_text", description: "\u7B80\u5386\u539F\u59CB\u6587\u672C" },
      { name: "position", description: "\u5E94\u8058\u5C97\u4F4D" }
    ],
    generate_interview_questions: [
      { name: "candidate_name", description: "\u5019\u9009\u4EBA\u59D3\u540D" },
      { name: "position", description: "\u5E94\u8058\u5C97\u4F4D" },
      { name: "jd_text", description: "\u5C97\u4F4D\u63CF\u8FF0" },
      { name: "resume_text", description: "\u7B80\u5386\u6587\u672C" },
      { name: "dimensions", description: "\u8BC4\u4F30\u7EF4\u5EA6" }
    ],
    generate_interview_evaluation: [
      { name: "candidate_name", description: "\u5019\u9009\u4EBA\u59D3\u540D" },
      { name: "position", description: "\u5E94\u8058\u5C97\u4F4D" },
      { name: "questions", description: "\u9762\u8BD5\u9898\u76EE" },
      { name: "answers", description: "\u5019\u9009\u4EBA\u56DE\u7B54" },
      { name: "dimensions", description: "\u8BC4\u4F30\u7EF4\u5EA6" }
    ],
    generate_interview_evaluation_from_transcript: [
      { name: "candidate_name", description: "\u5019\u9009\u4EBA\u59D3\u540D" },
      { name: "position", description: "\u5E94\u8058\u5C97\u4F4D" },
      { name: "transcript", description: "\u9762\u8BD5\u8F6C\u5199\u6587\u672C" },
      { name: "dimensions", description: "\u8BC4\u4F30\u7EF4\u5EA6" }
    ],
    generate_coding_test_evaluation: [
      { name: "candidate_name", description: "\u5019\u9009\u4EBA\u59D3\u540D" },
      { name: "position", description: "\u5E94\u8058\u5C97\u4F4D" },
      { name: "test_description", description: "\u7B14\u8BD5\u9898\u76EE\u63CF\u8FF0" },
      { name: "code", description: "\u5019\u9009\u4EBA\u63D0\u4EA4\u7684\u4EE3\u7801" }
    ],
    parse_resume_pdf: [
      { name: "candidate_name", description: "\u5019\u9009\u4EBA\u59D3\u540D\uFF08\u4ECE\u6587\u4EF6\u540D\u63D0\u53D6\uFF09" },
      { name: "resume_text", description: "\u7B80\u5386PDF\u7684base64\u6587\u672C\u5185\u5BB9" }
    ]
  };
  const all_variables = {};
  for (const [, vars] of Object.entries(variables_by_prompt)) {
    for (const v of vars) {
      if (!all_variables[v.name]) {
        all_variables[v.name] = v.description;
      }
    }
  }
  return c.json({ variables_by_prompt, all_variables });
});
app.put("/api/settings/prompts/:key", authMiddleware, async (c) => {
  try {
    const key = c.req.param("key");
    const body = await c.req.json();
    const { system, user } = body;
    if (!system || !user) {
      return c.json({ detail: "system \u548C user \u5B57\u6BB5\u4E3A\u5FC5\u586B" }, 400);
    }
    const row = await c.env.DB.prepare("SELECT id, prompt_configs FROM system_configs ORDER BY updated_at DESC LIMIT 1").first();
    let configs = {};
    if (row?.prompt_configs) {
      try {
        configs = JSON.parse(row.prompt_configs);
      } catch {
        configs = {};
      }
    }
    if (!configs.prompts) configs.prompts = {};
    configs.prompts[key] = { system, user };
    if (row) {
      await c.env.DB.prepare("UPDATE system_configs SET prompt_configs = ?, updated_at = ? WHERE id = ?").bind(JSON.stringify(configs), now(), row.id).run();
    } else {
      const id = uuid();
      await c.env.DB.prepare("INSERT INTO system_configs (id, prompt_configs, updated_at) VALUES (?, ?, ?)").bind(id, JSON.stringify(configs), now()).run();
    }
    return c.json({ detail: "Prompt updated", key });
  } catch (e) {
    return c.json({ detail: "\u66F4\u65B0\u5931\u8D25: " + e.message }, 500);
  }
});
app.post("/api/settings/mail/test", authMiddleware, async (c) => {
  return c.json({ detail: "Mail sending not available in serverless mode" });
});
app.get("/api/settings/interviewers", authMiddleware, async (c) => {
  try {
    const rows = await c.env.DB.prepare("SELECT * FROM interviewer_mappings ORDER BY name").all();
    return c.json(rows.results || []);
  } catch (e) {
    return c.json([]);
  }
});
app.put("/api/settings/interviewers", authMiddleware, async (c) => {
  const body = await c.req.json();
  const items = body.items || body || [];
  try {
    await c.env.DB.prepare("DELETE FROM interviewer_mappings").run();
    for (const item of items) {
      if (item.name && item.open_id) {
        await c.env.DB.prepare(
          "INSERT INTO interviewer_mappings (id, name, open_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)"
        ).bind(uuid(), item.name, item.open_id, now(), now()).run();
      }
    }
    const rows = await c.env.DB.prepare("SELECT * FROM interviewer_mappings ORDER BY name").all();
    return c.json({ ok: true, count: rows.results?.length || 0, items: rows.results || [] });
  } catch (e) {
    return c.json({ detail: "\u4FDD\u5B58\u5931\u8D25: " + e.message }, 500);
  }
});
app.post("/api/settings/interviewers/notify-all", authMiddleware, async (c) => {
  try {
    const { title, content } = await c.req.json();
    const operatorName = c.get("user")?.full_name || "";
    const rows = await c.env.DB.prepare("SELECT * FROM interviewer_mappings ORDER BY name").all();
    if (!rows.results || rows.results.length === 0) {
      return c.json({ detail: "\u6CA1\u6709\u914D\u7F6E\u9762\u8BD5\u5B98\u6620\u5C04" }, 400);
    }
    const token = await getFeishuToken(c.env);
    const card = {
      config: { wide_screen_mode: true },
      header: {
        title: { tag: "plain_text", content: title || "\u{1F4E2} \u9762\u8BD5\u5B98\u901A\u77E5" },
        template: "blue"
      },
      elements: [
        { tag: "markdown", content: content || "\u8BF7\u53CA\u65F6\u67E5\u770B\u7CFB\u7EDF\u5B89\u6392\u3002" },
        {
          tag: "action",
          actions: [
            {
              tag: "button",
              text: { tag: "plain_text", content: "\u6253\u5F00\u7CFB\u7EDF" },
              type: "primary",
              multi_url: {
                url: "https://ai-interview-22u.pages.dev",
                pc_url: "https://ai-interview-22u.pages.dev",
                ios_url: "",
                android_url: ""
              }
            }
          ]
        },
        {
          tag: "note",
          elements: [{ tag: "plain_text", content: `\u7531 ${operatorName || "\u7CFB\u7EDF"} \u53D1\u9001 | AI \u667A\u80FD\u9762\u8BD5\u7CFB\u7EDF` }]
        }
      ]
    };
    const results = [];
    for (const row of rows.results) {
      try {
        await sendFeishuMessageToUser(token, row.open_id, card);
        results.push(`${row.name}: \u2705`);
      } catch (e) {
        results.push(`${row.name}: \u274C ${e.message}`);
      }
    }
    return c.json({ ok: true, total: results.length, details: results });
  } catch (e) {
    return c.json({ detail: "\u901A\u77E5\u5931\u8D25: " + e.message }, 500);
  }
});
async function ensureEvalDimsColumn(db) {
  try {
    await db.prepare("ALTER TABLE system_configs ADD COLUMN evaluation_dimensions TEXT DEFAULT '[]'").run();
  } catch {
  }
}
app.get("/api/settings/evaluation-dimensions", authMiddleware, async (c) => {
  try {
    await ensureEvalDimsColumn(c.env.DB);
    const row = await c.env.DB.prepare("SELECT evaluation_dimensions FROM system_configs ORDER BY updated_at DESC LIMIT 1").first();
    if (!row?.evaluation_dimensions) return c.json([]);
    try {
      return c.json(JSON.parse(row.evaluation_dimensions));
    } catch {
      return c.json([]);
    }
  } catch {
    return c.json([]);
  }
});
app.put("/api/settings/evaluation-dimensions", authMiddleware, async (c) => {
  try {
    await ensureEvalDimsColumn(c.env.DB);
    const body = await c.req.json();
    const items = JSON.stringify(body.items || []);
    const existing = await c.env.DB.prepare("SELECT id FROM system_configs ORDER BY updated_at DESC LIMIT 1").first();
    if (existing?.id) {
      await c.env.DB.prepare("UPDATE system_configs SET evaluation_dimensions = ?, updated_at = ? WHERE id = ?").bind(items, now(), existing.id).run();
    } else {
      await c.env.DB.prepare("INSERT INTO system_configs (id, evaluation_dimensions, updated_at) VALUES (?, ?, ?)").bind(uuid(), items, now()).run();
    }
    return c.json({ ok: true });
  } catch (e) {
    return c.json({ detail: "\u4FDD\u5B58\u5931\u8D25: " + e.message }, 500);
  }
});
app.get("/api/positions/:id", async (c) => {
  const row = await c.env.DB.prepare("SELECT * FROM positions WHERE id = ?").bind(c.req.param("id")).first();
  if (!row) return c.json({ detail: "Not found" }, 404);
  return c.json(transformRow(row));
});
app.get("/api/public/review/:resumeId", async (c) => {
  const row = await c.env.DB.prepare("SELECT * FROM resumes WHERE id = ?").bind(c.req.param("resumeId")).first();
  if (!row) return c.json({ detail: "Not found" }, 404);
  return c.json(transformRow(row));
});
app.post("/api/init/reset", authMiddleware, requireRole(["admin"]), async (c) => {
  const transactionalTables = [
    "workflow_node_executions",
    "workflow_executions",
    "probation_records",
    "onboarding_records",
    "background_checks",
    "interview_panels",
    "interviews",
    "department_reviews",
    "resumes"
  ];
  const results = {};
  for (const table of transactionalTables) {
    const r = await c.env.DB.prepare(`DELETE FROM ${table}`).run();
    results[table] = r.meta?.changes ?? 0;
  }
  return c.json({ success: true, deleted: results });
});
app.get("/api/init/status", authMiddleware, requireRole(["admin"]), async (c) => {
  const migrations = [
    "ALTER TABLE positions ADD COLUMN responsible_person TEXT DEFAULT ''",
    "ALTER TABLE positions ADD COLUMN personalized_requirements TEXT DEFAULT ''",
    "ALTER TABLE positions ADD COLUMN capability_dimensions TEXT DEFAULT '[]'",
    "ALTER TABLE users ADD COLUMN feishu_token TEXT DEFAULT ''",
    "ALTER TABLE positions ADD COLUMN primary_interviewer TEXT DEFAULT ''",
    "ALTER TABLE positions ADD COLUMN secondary_interviewer TEXT DEFAULT ''",
    "ALTER TABLE interviews ADD COLUMN primary_interviewer TEXT DEFAULT ''",
    "ALTER TABLE interviews ADD COLUMN secondary_interviewer TEXT DEFAULT ''"
  ];
  for (const sql of migrations) {
    try {
      await c.env.DB.prepare(sql).run();
    } catch {
    }
  }
  const counts = {};
  const tables = ["positions", "resumes", "interviews", "users", "job_requisitions"];
  for (const table of tables) {
    const r = await c.env.DB.prepare(`SELECT COUNT(*) as cnt FROM ${table}`).first();
    counts[table] = r?.cnt ?? 0;
  }
  return c.json(counts);
});
app.post("/api/position-mappings/sync-from-feishu", authMiddleware, async (c) => {
  try {
    const tableId = getBitableTableId(c.env, "requisition");
    const records = await bitableListRecords(c.env, tableId);
    const agg = {};
    for (const rec of records) {
      const f = rec.fields || {};
      const title = defaultIfEmpty(getFirstValue(f["\u62DB\u8058\u5C97\u4F4D"]), "(\u672A\u547D\u540D\u5C97\u4F4D)");
      if (!title || title === "(\u672A\u547D\u540D\u5C97\u4F4D)") continue;
      if (!agg[title]) {
        agg[title] = { responsible_person: "", interviewers: [] };
      }
      const person = getUserName(f["\u8D23\u4EFB\u4EBA"]) || "\u5F85\u5206\u914D";
      if (person && !agg[title].responsible_person) {
        agg[title].responsible_person = person;
      }
      for (const key of ["\u4E1A\u52A1\u4E00\u9762", "HR\u4E8C\u9762", "\u7EC8\u9762"]) {
        const raw2 = f[key];
        if (!raw2) continue;
        const names = [];
        if (Array.isArray(raw2)) {
          for (const item of raw2) {
            const n = getUserName(item);
            if (n) names.push(n);
          }
        } else {
          const n = getUserName(raw2);
          if (n) names.push(n);
        }
        for (const name of names) {
          if (name && !agg[title].interviewers.some((i) => i.name === name)) {
            agg[title].interviewers.push({ name, role: key });
          }
        }
      }
    }
    let created = 0;
    let updated = 0;
    for (const [title, info] of Object.entries(agg)) {
      const existing = await c.env.DB.prepare(
        "SELECT id, raw_names FROM position_mappings WHERE mapped_name = ? LIMIT 1"
      ).bind(title).first();
      if (existing) {
        let newRawNames = [];
        try {
          newRawNames = JSON.parse(existing.raw_names || "[]");
        } catch {
        }
        if (!newRawNames.includes(title)) {
          newRawNames.push(title);
        }
        await c.env.DB.prepare(
          "UPDATE position_mappings SET responsible_person = ?, raw_names = ?, interviewers = ?, updated_at = ? WHERE id = ?"
        ).bind(
          info.responsible_person,
          JSON.stringify(newRawNames),
          JSON.stringify(info.interviewers),
          now(),
          existing.id
        ).run();
        updated++;
      } else {
        const id = uuid();
        await c.env.DB.prepare(
          "INSERT INTO position_mappings (id, mapped_name, raw_names, responsible_person, interviewers, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
        ).bind(
          id,
          title,
          JSON.stringify([title]),
          info.responsible_person,
          JSON.stringify(info.interviewers),
          now(),
          now()
        ).run();
        created++;
      }
    }
    return c.json({
      ok: true,
      message: `\u540C\u6B65\u5B8C\u6210\uFF1A\u65B0\u589E ${created} \u6761\u6620\u5C04\uFF0C\u66F4\u65B0 ${updated} \u6761`,
      created,
      updated
    });
  } catch (e) {
    return c.json({ detail: "\u540C\u6B65\u5931\u8D25: " + e.message }, 500);
  }
});
registerCrud("position-mappings", "position_mappings", { raw_name: "like", mapped_name: "like" });
registerCrud("capability-dimensions", "capability_dimensions", { position_name: "like" });
app.get("/api/capability-dimension-names", authMiddleware, async (c) => {
  const db = c.env.DB;
  const rows = await db.prepare("SELECT dimensions_json FROM capability_dimensions").all();
  const names = /* @__PURE__ */ new Set();
  for (const row of rows.results || []) {
    let dims = [];
    try {
      dims = JSON.parse(row.dimensions_json || "[]");
    } catch {
    }
    for (const d of dims) {
      if (d.name) names.add(d.name);
    }
  }
  return c.json(Array.from(names).sort());
});
registerCrud("recruitment-tasks", "recruitment_tasks", { status: "eq", position_name: "like" });
app.get("/api/resume-screening", authMiddleware, async (c) => {
  const db = c.env.DB;
  const status = c.req.query("status") || "";
  const search = c.req.query("search") || "";
  let sql = "SELECT * FROM resume_screening_queue";
  const conditions = [];
  const binds = [];
  if (status) {
    conditions.push("status = ?");
    binds.push(status);
  }
  if (search) {
    conditions.push("(candidate_name LIKE ? OR position_applied LIKE ?)");
    binds.push(`%${search}%`, `%${search}%`);
  }
  if (conditions.length > 0) sql += " WHERE " + conditions.join(" AND ");
  sql += " ORDER BY created_at DESC";
  const result = await db.prepare(sql).bind(...binds).all();
  return c.json(result.results.map(transformRow));
});
app.get("/api/resume-screening/:id", authMiddleware, async (c) => {
  const row = await c.env.DB.prepare("SELECT * FROM resume_screening_queue WHERE id = ?").bind(c.req.param("id")).first();
  if (!row) return c.json({ detail: "Not found" }, 404);
  return c.json(transformRow(row));
});
app.post("/api/resume-screening", authMiddleware, async (c) => {
  const body = await c.req.json();
  const id = body.id || uuid();
  const ts = now();
  await c.env.DB.prepare(
    `INSERT INTO resume_screening_queue (id, resume_id, candidate_name, position_applied, mapped_position, city, ai_analysis, ai_result, match_score, risk_points, match_reasons, interview_questions, strengths, age, gender, education, file_name, email_subject, status, batch_num, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(
    id,
    body.resume_id || null,
    body.candidate_name || "\u672A\u77E5",
    body.position_applied || "",
    body.mapped_position || "",
    body.city || "",
    body.ai_analysis || "",
    body.ai_result || "pending",
    body.match_score || 0,
    body.risk_points || "",
    body.match_reasons || "",
    body.interview_questions || "",
    body.strengths || "",
    body.age || "",
    body.gender || "",
    body.education || "",
    body.file_name || "",
    body.email_subject || "",
    body.status || "pending",
    body.batch_num || 1,
    ts,
    ts
  ).run();
  const row = await c.env.DB.prepare("SELECT * FROM resume_screening_queue WHERE id = ?").bind(id).first();
  return c.json(transformRow(row));
});
app.post("/api/resume-screening/:id/ai-analyze", authMiddleware, async (c) => {
  const id = c.req.param("id");
  const record = await c.env.DB.prepare("SELECT * FROM resume_screening_queue WHERE id = ?").bind(id).first();
  if (!record) return c.json({ detail: "Not found" }, 404);
  let resumeText = "";
  if (record.resume_id) {
    const resume = await c.env.DB.prepare("SELECT raw_text FROM resumes WHERE id = ?").bind(record.resume_id).first();
    if (resume?.raw_text) resumeText = resume.raw_text;
  }
  if (!resumeText) resumeText = record.ai_analysis || "\u65E0\u7B80\u5386\u6587\u672C";
  let mappedPosition = record.mapped_position || "";
  if (!mappedPosition && record.position_applied) {
    const pmRow = await c.env.DB.prepare("SELECT mapped_name FROM position_mappings WHERE raw_name LIKE ? LIMIT 1").bind(`%${record.position_applied.split("_")[0]}%`).first();
    if (pmRow?.mapped_name) mappedPosition = pmRow.mapped_name;
  }
  if (!mappedPosition) mappedPosition = record.position_applied?.split("_")[0] || "\u672A\u77E5\u5C97\u4F4D";
  const dimsResult = await c.env.DB.prepare("SELECT full_text FROM capability_dimensions WHERE position_name = ? LIMIT 3").bind(mappedPosition).all();
  let dimensionsText = "";
  if (dimsResult.results && dimsResult.results.length > 0) {
    dimensionsText = dimsResult.results.map((r) => r.full_text || "").filter(Boolean).join("\n");
  }
  const reqRow = await c.env.DB.prepare("SELECT requirements FROM job_requisitions WHERE title LIKE ? LIMIT 1").bind(`%${mappedPosition}%`).first();
  const jdText = reqRow?.requirements || "(\u65E0JD)";
  const systemPrompt = `\u4F60\u662F\u4E00\u4E2A\u4E13\u4E1A\u7684\u4EBA\u529B\u8D44\u6E90\u7B80\u5386\u521D\u7B5B\u4E13\u5BB6\uFF08AI\u7B80\u5386\u5206\u6790\u5F15\u64CE\uFF09\u3002\u4F60\u7684\u4EFB\u52A1\u662F\u5206\u6790\u5019\u9009\u4EBA\u7B80\u5386\uFF0C\u8BC4\u4F30\u5176\u4E0E\u76EE\u6807\u5C97\u4F4D\u7684\u5339\u914D\u5EA6\u3002

\u5206\u6790\u8981\u6C42\uFF1A
1. \u521D\u7B5B\u7ED3\u679C\uFF1A\u901A\u8FC7/\u4E0D\u901A\u8FC7/\u5F85\u5B9A
2. \u4F18\u52BF\u5206\u6790\uFF1A\u5019\u9009\u4EBA\u7684\u6838\u5FC3\u4F18\u52BF\uFF082-3\u6761\uFF09
3. \u98CE\u9669\u70B9\uFF1A\u6F5C\u5728\u98CE\u9669\u6216\u4E0D\u8DB3\uFF081-2\u6761\uFF09
4. \u80FD\u529B\u7EF4\u5EA6\u5339\u914D\uFF1A\u6309\u5C97\u4F4D\u80FD\u529B\u7EF4\u5EA6\u9010\u9879\u8BC4\u5206\uFF080-5\u5206\uFF09\uFF0C\u5E76\u7ED9\u51FA\u5339\u914D\u4F9D\u636E
5. \u5EFA\u8BAE\u8FFD\u95EE\u7684\u9762\u8BD5\u95EE\u9898\uFF083-5\u4E2A\uFF09
6. \u4E92\u52A8\u5F15\u5BFC\u8BED\uFF1A\u7ED9\u9762\u8BD5\u5B98\u7684\u4E00\u6BB5\u7B80\u77ED\u5F15\u5BFC

\u8BF7\u7528\u4EE5\u4E0B\u683C\u5F0F\u8F93\u51FA\uFF08\u4E2D\u6587\uFF09\uFF1A

\u521D\u7B5B\u7ED3\u679C\uFF1A[\u901A\u8FC7/\u4E0D\u901A\u8FC7/\u5F85\u5B9A]
\u5339\u914D\u5206\u6570\uFF1A[0-5\u7684\u6570\u5B57]

\u4F18\u52BF\u5206\u6790\uFF1A
\u2022 ...
\u2022 ...

\u98CE\u9669\u70B9\uFF1A
\u2022 ...

\u80FD\u529B\u7EF4\u5EA6\u5339\u914D\uFF1A
\u80FD\u529B\uFF1A[\u7EF4\u5EA6\u540D] [X]/5\u5206\u3002\u4F9D\u636E\uFF1A...
\u80FD\u529B\uFF1A[\u7EF4\u5EA6\u540D] [X]/5\u5206\u3002\u4F9D\u636E\uFF1A...

\u5EFA\u8BAE\u8FFD\u95EE\u7684\u9762\u8BD5\u95EE\u9898\uFF1A
1. ...
2. ...
3. ...

\u4E92\u52A8\u5F15\u5BFC\u8BED\uFF1A
[\u4E00\u6BB5\u7B80\u77ED\u7684\u8BDD]`;
  const userPrompt = `\u5C97\u4F4D\u540D\u79F0\uFF1A${mappedPosition}
\u5C97\u4F4DJD\uFF1A
${jdText}

\u5C97\u4F4D\u80FD\u529B\u7EF4\u5EA6\u8981\u6C42\uFF1A
${dimensionsText || "(\u65E0\u5177\u4F53\u7EF4\u5EA6\u8981\u6C42\uFF0C\u8BF7\u6839\u636E\u5C97\u4F4D\u5E38\u8BC6\u8BC4\u4F30)"}

\u5019\u9009\u4EBA\u4FE1\u606F\uFF1A
\u59D3\u540D\uFF1A${record.candidate_name}
\u5E74\u9F84\uFF1A${record.age || "\u672A\u77E5"}
\u6027\u522B\uFF1A${record.gender || "\u672A\u77E5"}
\u5B66\u5386\uFF1A${record.education || "\u672A\u77E5"}
\u7533\u8BF7\u5C97\u4F4D\uFF1A${record.position_applied || "\u672A\u77E5"}

\u7B80\u5386\u5185\u5BB9\uFF1A
${resumeText.substring(0, 6e3)}`;
  let aiAnalysis = "";
  try {
    aiAnalysis = await callAI(c.env, systemPrompt, userPrompt);
  } catch (e) {
    return c.json({ detail: `AI\u5206\u6790\u5931\u8D25: ${e.message}` }, 500);
  }
  const scoreMatch = aiAnalysis.match(/匹配分数[：:]\s*(\d+(\.\d+)?)/);
  const matchScore = scoreMatch ? parseFloat(scoreMatch[1]) : 0;
  const resultMatch = aiAnalysis.match(/初筛结果[：:]\s*(通过|不通过|待定)/);
  const aiResult = resultMatch ? resultMatch[1] : "pending";
  await c.env.DB.prepare(
    "UPDATE resume_screening_queue SET ai_analysis = ?, ai_result = ?, match_score = ?, mapped_position = ?, updated_at = ? WHERE id = ?"
  ).bind(aiAnalysis, aiResult, matchScore, mappedPosition, now(), id).run();
  const row = await c.env.DB.prepare("SELECT * FROM resume_screening_queue WHERE id = ?").bind(id).first();
  return c.json(transformRow(row));
});
app.post("/api/resume-screening/:id/approve", authMiddleware, async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const record = await c.env.DB.prepare("SELECT * FROM resume_screening_queue WHERE id = ?").bind(id).first();
  if (!record) return c.json({ detail: "Not found" }, 404);
  if (record.status !== "pending") return c.json({ detail: "Already processed" }, 400);
  await c.env.DB.prepare(
    "UPDATE resume_screening_queue SET status = ?, ai_result = ?, reviewed_by = ?, reviewed_at = ?, updated_at = ? WHERE id = ?"
  ).bind("approved", "shortlisted", user.id, now(), now(), id).run();
  c.executionCtx.waitUntil((async () => {
    try {
      const token = await getFeishuToken(c.env);
      const appToken = c.env.FEISHU_BITABLE_APP_TOKEN || FEISHU_CONFIG.appToken;
      const talentTableId = c.env.FEISHU_TALENT_TABLE_ID || FEISHU_CONFIG.talentTableId;
      const posName = record.mapped_position || record.position_applied?.split("_")[0] || "\u672A\u77E5\u5C97\u4F4D";
      await createFeishuBitableRecord(token, appToken, talentTableId, {
        "\u59D3\u540D": record.candidate_name || "\u672A\u77E5",
        "\u5E74\u9F84": record.age || null,
        "\u6027\u522B": record.gender || null,
        "\u5B66\u5386": record.education || null,
        "\u9762\u8BD5\u5C97\u4F4D": record.position_applied || null,
        "\u62DB\u8058\u5C97\u4F4D": posName,
        "\u57CE\u5E02": record.city || null,
        "AI\u7B80\u5386\u8BC4\u4F30": record.ai_analysis || "",
        "AI\u7B80\u5386\u521D\u7B5B\u7ED3\u679C": "\u5DF2\u5165\u5E93"
      });
      const updated = await c.env.DB.prepare("SELECT * FROM resume_screening_queue WHERE id = ?").bind(id).first();
      await pushCandidateToGroup(c.env, updated);
      await notifyInterviewersForCandidate(c.env, token, updated);
    } catch (e) {
      console.error(`\u5165\u5E93\u540E\u5904\u7406\u5931\u8D25: ${e.message}`);
    }
  })());
  const row = await c.env.DB.prepare("SELECT * FROM resume_screening_queue WHERE id = ?").bind(id).first();
  return c.json(transformRow(row));
});
app.post("/api/resume-screening/:id/reject", authMiddleware, async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const record = await c.env.DB.prepare("SELECT * FROM resume_screening_queue WHERE id = ?").bind(id).first();
  if (!record) return c.json({ detail: "Not found" }, 404);
  if (record.status !== "pending") return c.json({ detail: "Already processed" }, 400);
  await c.env.DB.prepare(
    "UPDATE resume_screening_queue SET status = ?, ai_result = ?, reviewed_by = ?, reviewed_at = ?, updated_at = ? WHERE id = ?"
  ).bind("rejected", "rejected", user.id, now(), now(), id).run();
  const row = await c.env.DB.prepare("SELECT * FROM resume_screening_queue WHERE id = ?").bind(id).first();
  return c.json(transformRow(row));
});
app.post("/api/resume-screening/batch-analyze", authMiddleware, async (c) => {
  const result = await c.env.DB.prepare("SELECT id FROM resume_screening_queue WHERE status = 'pending' AND (ai_analysis IS NULL OR ai_analysis = '')").all();
  const ids = result.results.map((r) => r.id);
  let processed = 0;
  for (const rid of ids) {
    try {
      const rec = await c.env.DB.prepare("SELECT * FROM resume_screening_queue WHERE id = ?").bind(rid).first();
      if (!rec) continue;
      let resumeText = "";
      if (rec.resume_id) {
        const resume = await c.env.DB.prepare("SELECT raw_text FROM resumes WHERE id = ?").bind(rec.resume_id).first();
        if (resume?.raw_text) resumeText = resume.raw_text;
      }
      if (!resumeText) continue;
      let mappedPosition = rec.mapped_position || rec.position_applied?.split("_")[0] || "\u672A\u77E5\u5C97\u4F4D";
      const dimsResult = await c.env.DB.prepare("SELECT full_text FROM capability_dimensions WHERE position_name = ? LIMIT 3").bind(mappedPosition).all();
      const dimensionsText = dimsResult.results?.map((r) => r.full_text || "").filter(Boolean).join("\n") || "";
      const systemPrompt = `\u4F60\u662F\u7B80\u5386\u521D\u7B5B\u4E13\u5BB6\u3002\u5206\u6790\u7B80\u5386\u5E76\u8F93\u51FA\uFF1A\u521D\u7B5B\u7ED3\u679C\uFF08\u901A\u8FC7/\u4E0D\u901A\u8FC7/\u5F85\u5B9A\uFF09\u3001\u5339\u914D\u5206\u6570\uFF080-5\uFF09\u3001\u4F18\u52BF\u5206\u6790\u3001\u98CE\u9669\u70B9\u3001\u80FD\u529B\u7EF4\u5EA6\u5339\u914D\uFF08\u6BCF\u98790-5\u5206\uFF09\u3001\u9762\u8BD5\u95EE\u9898\u5EFA\u8BAE\uFF083\u4E2A\uFF09\u3001\u4E92\u52A8\u5F15\u5BFC\u8BED\u3002\u7528\u4E2D\u6587\u8F93\u51FA\u3002`;
      const userPrompt = `\u5C97\u4F4D\uFF1A${mappedPosition}
\u80FD\u529B\u7EF4\u5EA6\u8981\u6C42\uFF1A${dimensionsText || "(\u65E0)"}
\u5019\u9009\u4EBA\uFF1A${rec.candidate_name} ${rec.age || ""}\u5C81 ${rec.gender || ""} ${rec.education || ""}
\u7B80\u5386\uFF1A${resumeText.substring(0, 5e3)}`;
      const aiAnalysis = await callAI(c.env, systemPrompt, userPrompt);
      const scoreMatch = aiAnalysis.match(/匹配分数[：:]\s*(\d+(\.\d+)?)/);
      const matchScore = scoreMatch ? parseFloat(scoreMatch[1]) : 0;
      const resultMatch = aiAnalysis.match(/初筛结果[：:]\s*(通过|不通过|待定)/);
      const aiResult = resultMatch ? resultMatch[1] : "pending";
      await c.env.DB.prepare("UPDATE resume_screening_queue SET ai_analysis = ?, ai_result = ?, match_score = ?, mapped_position = ?, updated_at = ? WHERE id = ?").bind(aiAnalysis, aiResult, matchScore, mappedPosition, now(), rid).run();
      processed++;
    } catch (e) {
    }
  }
  return c.json({ processed, total: ids.length });
});
app.post("/api/resume-screening/from-resume/:resumeId", authMiddleware, async (c) => {
  const resumeId = c.req.param("resumeId");
  const resume = await c.env.DB.prepare("SELECT * FROM resumes WHERE id = ?").bind(resumeId).first();
  if (!resume) return c.json({ detail: "Resume not found" }, 404);
  const id = uuid();
  const ts = now();
  const positionApplied = resume.position_title || resume.target_position || "";
  let mappedPosition = "";
  if (positionApplied) {
    const pmRow = await c.env.DB.prepare('SELECT mapped_name FROM position_mappings WHERE ? LIKE "%" || raw_name || "%" LIMIT 1').bind(positionApplied).first();
    if (pmRow?.mapped_name) mappedPosition = pmRow.mapped_name;
  }
  await c.env.DB.prepare(
    `INSERT INTO resume_screening_queue (id, resume_id, candidate_name, position_applied, mapped_position, age, gender, education, status, batch_num, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(id, resumeId, resume.candidate_name || "\u672A\u77E5", positionApplied, mappedPosition, resume.age || "", resume.gender || "", resume.education || "", "pending", 1, ts, ts).run();
  const row = await c.env.DB.prepare("SELECT * FROM resume_screening_queue WHERE id = ?").bind(id).first();
  return c.json(transformRow(row));
});
app.get("/api/daily-reports", authMiddleware, async (c) => {
  const owner = c.req.query("owner");
  let sql = "SELECT * FROM daily_reports";
  const params = [];
  if (owner && owner !== "all") {
    sql += " WHERE biz_owner = ?";
    params.push(owner);
  }
  sql += " ORDER BY created_at DESC LIMIT 100";
  const result = await c.env.DB.prepare(sql).bind(...params).all();
  return c.json(result.results.map(transformRow));
});
app.get("/api/daily-reports/owners", authMiddleware, async (c) => {
  const { results: fromReports } = await c.env.DB.prepare(
    "SELECT DISTINCT biz_owner FROM daily_reports WHERE biz_owner IS NOT NULL AND biz_owner != '' ORDER BY biz_owner"
  ).all();
  const { results: fromPositions } = await c.env.DB.prepare(
    "SELECT DISTINCT responsible_person FROM positions WHERE responsible_person IS NOT NULL AND responsible_person != '' ORDER BY responsible_person"
  ).all();
  const owners = /* @__PURE__ */ new Set();
  (fromReports || []).forEach((r) => {
    if (r.biz_owner) owners.add(r.biz_owner);
  });
  (fromPositions || []).forEach((r) => {
    if (r.responsible_person) owners.add(r.responsible_person);
  });
  return c.json({ owners: Array.from(owners).sort() });
});
app.post("/api/daily-reports/generate", authMiddleware, async (c) => {
  const body = await c.req.json().catch(() => ({})) || {};
  const reportType = body.report_type || "progress";
  const reportDate = body.report_date || (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  const reportOwner = body.biz_owner || "";
  const isFiltered = !!reportOwner;
  if (isFiltered) {
    const totalResumes2 = await c.env.DB.prepare("SELECT COUNT(*) as cnt FROM resumes WHERE biz_owner = ?").bind(reportOwner).first();
    const totalScreening2 = await c.env.DB.prepare("SELECT COUNT(*) as cnt FROM resume_screening_queue WHERE biz_owner = ? AND status = 'pending'").bind(reportOwner).first();
    const totalApproved2 = await c.env.DB.prepare("SELECT COUNT(*) as cnt FROM resume_screening_queue WHERE biz_owner = ? AND status = 'approved'").bind(reportOwner).first();
    const totalRejected2 = await c.env.DB.prepare("SELECT COUNT(*) as cnt FROM resume_screening_queue WHERE biz_owner = ? AND status = 'rejected'").bind(reportOwner).first();
    const totalInterviews2 = await c.env.DB.prepare("SELECT COUNT(*) as cnt FROM interviews WHERE biz_owner = ? AND status IN ('scheduled','completed')").bind(reportOwner).first();
    const totalOnboarding2 = await c.env.DB.prepare("SELECT COUNT(*) as cnt FROM onboarding_records WHERE biz_owner = ? AND status = 'in_progress'").bind(reportOwner).first();
    const stats2 = {
      report_date: reportDate,
      open_requisitions: 0,
      total_resumes: totalResumes2?.cnt || 0,
      pending_screening: totalScreening2?.cnt || 0,
      approved_candidates: totalApproved2?.cnt || 0,
      rejected_candidates: totalRejected2?.cnt || 0,
      active_interviews: totalInterviews2?.cnt || 0,
      onboarding_count: totalOnboarding2?.cnt || 0
    };
    let aiSummary2 = "";
    try {
      aiSummary2 = await callAI(
        c.env,
        `\u4F60\u662F\u62DB\u8058\u6570\u636E\u5206\u6790\u4E13\u5BB6\u3002\u6839\u636E\u8D1F\u8D23\u4EBA"${reportOwner}"\u7684\u7EDF\u8BA1\u6570\u636E\u751F\u6210\u4E00\u4EFD\u7B80\u6D01\u7684\u65E5\u62A5\u6458\u8981\uFF08\u4E2D\u6587\uFF0C200\u5B57\u4EE5\u5185\uFF09\uFF0C\u5305\u542B\u8BE5\u8D1F\u8D23\u4EBA\u7684\u62DB\u8058\u8FDB\u5C55\u6982\u8FF0\u548C\u5173\u952E\u6307\u6807\u3002\u76F4\u63A5\u8F93\u51FA\u7EAF\u6587\u5B57\u3002`,
        `\u8D1F\u8D23\u4EBA\uFF1A${reportOwner}
\u65E5\u671F\uFF1A${reportDate}
\u7EDF\u8BA1\u6570\u636E\uFF1A${JSON.stringify(stats2, null, 2)}`
      );
    } catch {
      aiSummary2 = "(AI\u6458\u8981\u751F\u6210\u5931\u8D25)";
    }
    const title2 = `${reportOwner} \xB7 \u62DB\u8058\u65E5\u62A5 - ${reportDate}`;
    const id2 = uuid();
    await c.env.DB.prepare(
      "INSERT INTO daily_reports (id, report_date, report_type, title, content, stats, status, biz_owner, created_at) VALUES (?,?,?,?,?,?,?,?,?)"
    ).bind(id2, reportDate, reportType, title2, JSON.stringify(stats2), aiSummary2, "generated", reportOwner, now()).run();
    const row2 = await c.env.DB.prepare("SELECT * FROM daily_reports WHERE id = ?").bind(id2).first();
    return c.json(transformRow(row2));
  }
  const totalResumes = await c.env.DB.prepare("SELECT COUNT(*) as cnt FROM resumes").first();
  const totalScreening = await c.env.DB.prepare("SELECT COUNT(*) as cnt FROM resume_screening_queue WHERE status = 'pending'").first();
  const totalApproved = await c.env.DB.prepare("SELECT COUNT(*) as cnt FROM resume_screening_queue WHERE status = 'approved'").first();
  const totalRejected = await c.env.DB.prepare("SELECT COUNT(*) as cnt FROM resume_screening_queue WHERE status = 'rejected'").first();
  const totalInterviews = await c.env.DB.prepare("SELECT COUNT(*) as cnt FROM interviews WHERE status IN ('scheduled','completed')").first();
  const totalOnboarding = await c.env.DB.prepare("SELECT COUNT(*) as cnt FROM onboarding_records WHERE status = 'in_progress'").first();
  const openRequisitions = await c.env.DB.prepare("SELECT COUNT(*) as cnt FROM job_requisitions WHERE status = 'open'").first();
  const stats = {
    report_date: reportDate,
    open_requisitions: openRequisitions?.cnt || 0,
    total_resumes: totalResumes?.cnt || 0,
    pending_screening: totalScreening?.cnt || 0,
    approved_candidates: totalApproved?.cnt || 0,
    rejected_candidates: totalRejected?.cnt || 0,
    active_interviews: totalInterviews?.cnt || 0,
    onboarding_count: totalOnboarding?.cnt || 0
  };
  let aiSummary = "";
  try {
    aiSummary = await callAI(
      c.env,
      "\u4F60\u662F\u62DB\u8058\u6570\u636E\u5206\u6790\u4E13\u5BB6\u3002\u6839\u636E\u62DB\u8058\u7EDF\u8BA1\u6570\u636E\u751F\u6210\u4E00\u4EFD\u7B80\u6D01\u7684\u65E5\u62A5\u6458\u8981\uFF08\u4E2D\u6587\uFF09\uFF0C\u5305\u542B\uFF1A\u6574\u4F53\u8FDB\u5C55\u6982\u8FF0\u3001\u5173\u952E\u6307\u6807\u5206\u6790\u3001\u98CE\u9669\u63D0\u793A\u3001\u660E\u65E5\u5EFA\u8BAE\u3002\u63A7\u5236\u5728300\u5B57\u4EE5\u5185\u3002",
      `\u65E5\u671F\uFF1A${reportDate}
\u7EDF\u8BA1\u6570\u636E\uFF1A${JSON.stringify(stats, null, 2)}`
    );
  } catch {
    aiSummary = "(AI\u6458\u8981\u751F\u6210\u5931\u8D25)";
  }
  const title = `\u62DB\u8058\u65E5\u62A5 - ${reportDate}`;
  const id = uuid();
  await c.env.DB.prepare(
    "INSERT INTO daily_reports (id, report_date, report_type, title, content, stats, status, created_at) VALUES (?,?,?,?,?,?,?,?)"
  ).bind(id, reportDate, reportType, title, JSON.stringify(stats), aiSummary, "generated", now()).run();
  const row = await c.env.DB.prepare("SELECT * FROM daily_reports WHERE id = ?").bind(id).first();
  return c.json(transformRow(row));
});
app.delete("/api/daily-reports/:id", authMiddleware, async (c) => {
  await c.env.DB.prepare("DELETE FROM daily_reports WHERE id = ?").bind(c.req.param("id")).run();
  return c.json({ detail: "Report deleted" });
});
app.post("/api/daily-reports/:id/send", authMiddleware, async (c) => {
  try {
    const body = await c.req.json();
    const { target_type, target_id } = body;
    if (!target_type || !target_id) {
      return c.json({ detail: "\u8BF7\u6307\u5B9A\u53D1\u9001\u76EE\u6807" }, 400);
    }
    const row = await c.env.DB.prepare("SELECT * FROM daily_reports WHERE id = ?").bind(c.req.param("id")).first();
    if (!row) return c.json({ detail: "\u65E5\u62A5\u4E0D\u5B58\u5728" }, 404);
    const r = transformRow(row);
    const stats = r.content ? (() => {
      try {
        return JSON.parse(r.content);
      } catch {
        return {};
      }
    })() : {};
    const aiSummary = r.stats || "(\u65E0AI\u6458\u8981)";
    const cardContent = {
      config: { wide_screen_mode: true },
      header: {
        title: { tag: "plain_text", content: `\u{1F4CA} ${r.title || "\u62DB\u8058\u65E5\u62A5"}` },
        template: "blue"
      },
      elements: [
        {
          tag: "div",
          text: {
            tag: "lark_md",
            content: [
              `**\u62A5\u544A\u65E5\u671F**\uFF1A${r.report_date || "-"}`,
              `**\u5F85\u7B5B\u9009**\uFF1A${stats.pending_screening ?? "-"}`,
              `**\u9762\u8BD5\u4E2D**\uFF1A${stats.active_interviews ?? "-"}`,
              `**\u5DF2\u901A\u8FC7**\uFF1A${stats.approved_candidates ?? "-"}`,
              `**\u5165\u804C\u4E2D**\uFF1A${stats.onboarding_count ?? "-"}`,
              `**\u5F00\u653E\u9700\u6C42**\uFF1A${stats.open_requisitions ?? "-"}`,
              "",
              `**\u{1F4DD} AI \u6458\u8981**`,
              aiSummary.length > 500 ? aiSummary.slice(0, 500) + "..." : aiSummary
            ].join("\n")
          }
        },
        {
          tag: "hr"
        },
        {
          tag: "note",
          elements: [
            { tag: "plain_text", content: `AI \u667A\u80FD\u62DB\u8058\u7CFB\u7EDF \xB7 ${(/* @__PURE__ */ new Date()).toLocaleString("zh-CN")}` }
          ]
        }
      ]
    };
    const currentUser = c.get("user");
    const userToken = currentUser?.feishu_token;
    if (target_type === "chat") {
      const token = userToken || await getFeishuToken(c.env);
      await sendFeishuMessageToChat(token, target_id, cardContent);
    } else if (target_type === "user") {
      if (userToken) {
        await sendFeishuMessageWithFallback(c.env, target_id, cardContent, userToken);
      } else {
        await sendFeishuMessageToUser(await getFeishuToken(c.env), target_id, cardContent);
      }
    } else {
      return c.json({ detail: "\u4E0D\u652F\u6301\u7684\u53D1\u9001\u7C7B\u578B" }, 400);
    }
    return c.json({ ok: true, detail: "\u53D1\u9001\u6210\u529F" });
  } catch (e) {
    return c.json({ detail: "\u53D1\u9001\u5931\u8D25: " + e.message }, 500);
  }
});
async function getInterviewerOpenIds(env) {
  try {
    const rows = await env.DB.prepare("SELECT name, open_id FROM interviewer_mappings ORDER BY name").all();
    if (rows.results && rows.results.length > 0) {
      const map = {};
      for (const r of rows.results) {
        if (r.name && r.open_id) map[r.name] = r.open_id;
      }
      if (Object.keys(map).length > 0) return map;
    }
  } catch (e) {
    console.warn(`[Interviewer] DB read failed, using hardcoded: ${e.message}`);
  }
  return env.FEISHU_CONFIG?.interviewerOpenIds || FEISHU_CONFIG.interviewerOpenIds || {};
}
async function getInterviewerOpenId(env, name) {
  const map = await getInterviewerOpenIds(env);
  if (map[name]) {
    console.log(`[getInterviewerOpenId] \u4ECE interviewer_mappings \u627E\u5230 ${name}`);
    return map[name];
  }
  const contactOpenId = await getContactOpenId(env, name);
  if (contactOpenId) {
    console.log(`[getInterviewerOpenId] \u4ECE feishu_contacts \u627E\u5230 ${name} \u2192 ${contactOpenId}`);
    return contactOpenId;
  }
  try {
    const userRow = await env.DB.prepare(
      "SELECT feishu_open_id FROM users WHERE full_name = ? AND feishu_open_id IS NOT NULL AND feishu_open_id != '' LIMIT 1"
    ).bind(name).first();
    if (userRow?.feishu_open_id) {
      console.log(`[getInterviewerOpenId] \u4ECE users \u8868\u627E\u5230 ${name} \u7684 feishu_open_id`);
      return userRow.feishu_open_id;
    }
  } catch (e) {
    console.warn(`[getInterviewerOpenId] users \u8868\u67E5\u8BE2\u5931\u8D25: ${e.message}`);
  }
  try {
    const boundUsers = await env.DB.prepare(
      "SELECT full_name, feishu_open_id FROM users WHERE feishu_open_id IS NOT NULL AND feishu_open_id != ''"
    ).all();
    for (const u of boundUsers.results || []) {
      if (u.full_name && u.feishu_open_id && (u.full_name.includes(name) || name.includes(u.full_name))) {
        console.log(`[getInterviewerOpenId] \u6A21\u7CCA\u5339\u914D: ${name} \u2192 ${u.full_name}`);
        return u.feishu_open_id;
      }
    }
  } catch {
  }
  console.warn(`[getInterviewerOpenId] \u26A0 ${name} \u672A\u7ED1\u5B9A\u98DE\u4E66\uFF0C\u65E0\u6CD5\u53D1\u9001\u63D0\u9192\uFF08\u786C\u7F16\u7801 open_id \u5C5E\u4E8E\u5176\u4ED6\u5E94\u7528\u4E0D\u53EF\u7528\uFF09`);
  return "";
}
var feishuTokenCache = { token: "", expiresAt: 0 };
async function getFeishuToken(env) {
  if (feishuTokenCache.token && Date.now() < feishuTokenCache.expiresAt) {
    return feishuTokenCache.token;
  }
  const appId = env.FEISHU_APP_ID || FEISHU_CONFIG.appId;
  const appSecret = env.FEISHU_APP_SECRET || FEISHU_CONFIG.appSecret;
  const resp = await fetch("https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ app_id: appId, app_secret: appSecret })
  });
  const data = await resp.json();
  if (!data.tenant_access_token) {
    throw new Error(`Feishu auth failed: ${JSON.stringify(data)}`);
  }
  const ttl = (data.expire || 7200) * 850;
  feishuTokenCache.token = data.tenant_access_token;
  feishuTokenCache.expiresAt = Date.now() + ttl;
  return data.tenant_access_token;
}
async function refreshUserFeishuToken(env, userEmail) {
  try {
    const row = await env.DB.prepare(
      "SELECT refresh_token FROM feishu_tokens WHERE user_email = ? AND refresh_token != '' LIMIT 1"
    ).bind(userEmail).first();
    if (!row?.refresh_token) return null;
    const appId = env.FEISHU_APP_ID || FEISHU_CONFIG.appId;
    const appSecret = env.FEISHU_APP_SECRET || FEISHU_CONFIG.appSecret;
    const resp = await fetch("https://open.feishu.cn/open-apis/authen/v2/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "refresh_token",
        refresh_token: row.refresh_token,
        client_id: appId,
        client_secret: appSecret
      })
    });
    const data = await resp.json();
    if (data.code !== 0) {
      console.error(`[refreshUserFeishuToken] \u5237\u65B0\u5931\u8D25: code=${data.code}, msg=${data.msg}`);
      return null;
    }
    const newAccessToken = data.access_token || data.data?.access_token || "";
    const newRefreshToken = data.refresh_token || data.data?.refresh_token || "";
    const expiresIn = data.expires_in || data.data?.expires_in || 7200;
    const expiresAtUnix = Math.floor(Date.now() / 1e3) + expiresIn;
    const nowStr = now();
    await env.DB.prepare("DELETE FROM feishu_tokens WHERE user_email = ?").bind(userEmail).run();
    await env.DB.prepare(`
      INSERT INTO feishu_tokens (id, user_email, access_token, refresh_token, expires_at, open_id, name, created_at)
      VALUES (?, ?, ?, ?, ?, (SELECT IFNULL(feishu_open_id,'') FROM users WHERE email = ?), (SELECT IFNULL(feishu_name,'') FROM users WHERE email = ?), ?)
    `).bind(uuid(), userEmail, newAccessToken, newRefreshToken, expiresAtUnix, userEmail, userEmail, nowStr).run();
    await env.DB.prepare("UPDATE users SET feishu_token = ?, updated_at = ? WHERE email = ?").bind(newAccessToken, nowStr, userEmail).run();
    console.log(`[refreshUserFeishuToken] \u2705 ${userEmail} token \u5237\u65B0\u6210\u529F\uFF0C${expiresIn}s \u540E\u8FC7\u671F`);
    return newAccessToken;
  } catch (e) {
    console.error(`[refreshUserFeishuToken] \u5F02\u5E38: ${e.message}`);
    return null;
  }
}
async function getAnyUserFeishuToken(env) {
  try {
    const nowUnix = Math.floor(Date.now() / 1e3);
    const validRow = await env.DB.prepare(
      "SELECT user_email, access_token, expires_at FROM feishu_tokens WHERE access_token != '' AND expires_at > ? ORDER BY expires_at DESC LIMIT 1"
    ).bind(nowUnix).first();
    if (validRow?.access_token) {
      return validRow.access_token;
    }
    const expiredRow = await env.DB.prepare(
      "SELECT user_email FROM feishu_tokens WHERE refresh_token != '' ORDER BY expires_at DESC LIMIT 1"
    ).first();
    if (expiredRow?.user_email) {
      const refreshed = await refreshUserFeishuToken(env, expiredRow.user_email);
      if (refreshed) return refreshed;
    }
    const row = await env.DB.prepare(
      "SELECT feishu_token FROM users WHERE feishu_token IS NOT NULL AND feishu_token != '' LIMIT 1"
    ).first();
    return row?.feishu_token || null;
  } catch {
    return null;
  }
}
async function sendFeishuMessageWithFallback(env, openId, cardContent, preferredToken) {
  let lastError = null;
  if (preferredToken) {
    try {
      const resp = await fetch("https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=open_id", {
        method: "POST",
        headers: { "Authorization": `Bearer ${preferredToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          receive_id: openId,
          msg_type: "interactive",
          content: JSON.stringify(cardContent)
        })
      });
      const data = await resp.json();
      if (data.code === 0) return;
      if (data.code === 99991677 || data.code === 99991663) {
        console.log(`[sendFeishuMessageWithFallback] preferredToken \u8FC7\u671F\uFF0C\u5C1D\u8BD5\u81EA\u52A8\u5237\u65B0...`);
      } else {
        throw new Error(`\u53D1\u9001\u6D88\u606F\u5931\u8D25(${data.code}): ${JSON.stringify(data.msg || data)}`);
      }
    } catch (e) {
      if (e.message.includes("99991677") || e.message.includes("99991663") || e.message.includes("token \u8FC7\u671F")) {
        lastError = e;
      } else {
        throw e;
      }
    }
  }
  const dbToken = await getAnyUserFeishuToken(env);
  if (dbToken && dbToken !== preferredToken) {
    try {
      const resp = await fetch("https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=open_id", {
        method: "POST",
        headers: { "Authorization": `Bearer ${dbToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          receive_id: openId,
          msg_type: "interactive",
          content: JSON.stringify(cardContent)
        })
      });
      const data = await resp.json();
      if (data.code === 0) {
        console.log(`[sendFeishuMessageWithFallback] \u2705 \u4F7F\u7528\u5237\u65B0\u540E\u7684 user_access_token \u53D1\u9001\u6210\u529F`);
        return;
      }
      if (data.code === 99991677 || data.code === 99991663) {
        lastError = new Error(`\u5237\u65B0\u540E token \u4ECD\u8FC7\u671F(${data.code}): ${JSON.stringify(data.msg || data)}`);
      } else {
        throw new Error(`\u53D1\u9001\u6D88\u606F\u5931\u8D25(${data.code}): ${JSON.stringify(data.msg || data)}`);
      }
    } catch (e) {
      if (e.message.includes("99991677") || e.message.includes("99991663") || e.message.includes("token \u8FC7\u671F")) {
        lastError = e;
      } else {
        throw e;
      }
    }
  }
  try {
    const tenantToken = await getFeishuToken(env);
    await sendFeishuMessageToUser(tenantToken, openId, cardContent);
    console.log(`[sendFeishuMessageWithFallback] \u4F7F\u7528 tenant_access_token \u53D1\u9001\u6210\u529F`);
  } catch (e) {
    throw lastError || new Error(`\u6240\u6709 token \u90FD\u5931\u8D25: ${e.message}`);
  }
}
async function downloadFeishuAttachment(env, fileToken, tmpUrl) {
  try {
    if (tmpUrl) {
      const resp = await fetch(tmpUrl, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
        redirect: "follow"
      });
      if (resp.ok) {
        const ct = resp.headers.get("Content-Type") || "";
        if (ct.includes("pdf") || ct.includes("octet-stream") || ct.includes("binary") || ct.includes("application/") || !ct) {
          return new Response(resp.body, {
            status: 200,
            headers: {
              "Content-Type": ct || "application/pdf",
              "Content-Disposition": 'inline; filename="resume.pdf"',
              "Access-Control-Allow-Origin": "*",
              "Cache-Control": "public, max-age=3600"
            }
          });
        }
        console.error(`[FeishuAPI] tmp_url \u8FD4\u56DE\u975EPDF\u5185\u5BB9: ${ct?.substring(0, 100)}\uFF0C\u7EE7\u7EED\u5C1D\u8BD5\u5176\u4ED6\u65B9\u6CD5`);
      } else {
        console.error(`[FeishuAPI] tmp_url \u4E0B\u8F7D\u5931\u8D25 status=${resp.status}`);
      }
    }
    const token = await getFeishuToken(env);
    const tableId = getBitableTableId(env, "talent");
    const records = await bitableListRecords(env, tableId);
    let foundFieldId = "";
    let foundRecordId = "";
    for (const rec of records) {
      const ff = rec.fields || {};
      for (const [fn, fv] of Object.entries(ff)) {
        if (Array.isArray(fv) && fv.length > 0 && typeof fv[0] === "object" && fv[0].file_token === fileToken) {
          foundFieldId = fn;
          foundRecordId = rec.record_id;
          break;
        }
      }
      if (foundFieldId) break;
    }
    if (foundFieldId && foundRecordId) {
      const fieldsMeta = await getFieldMeta(env, token, tableId);
      let realFieldId = foundFieldId;
      for (const fm of fieldsMeta) {
        if (fm.field_name === foundFieldId || fm.field_id === foundFieldId) {
          realFieldId = fm.field_id;
          break;
        }
      }
      const extra = JSON.stringify({
        bitablePerm: {
          tableId,
          attachments: {
            [realFieldId]: {
              [foundRecordId]: [fileToken]
            }
          }
        }
      });
      const batchUrl = `https://open.feishu.cn/open-apis/drive/v1/medias/batch_get_tmp_download_url?file_tokens=${fileToken}&extra=${encodeURIComponent(extra)}`;
      const batchResp = await fetch(batchUrl, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (batchResp.ok) {
        const batchData = await batchResp.json();
        const arr = batchData?.data?.tmp_download_urls;
        if (arr && arr.length > 0 && arr[0].tmp_download_url) {
          const dlUrl = arr[0].tmp_download_url;
          const fileResp = await fetch(dlUrl, {
            headers: { "User-Agent": "Mozilla/5.0" },
            redirect: "follow"
          });
          if (fileResp.ok) {
            return new Response(fileResp.body, {
              status: 200,
              headers: {
                "Content-Type": fileResp.headers.get("Content-Type") || "application/pdf",
                "Content-Disposition": 'inline; filename="resume.pdf"',
                "Access-Control-Allow-Origin": "*",
                "Cache-Control": "public, max-age=3600"
              }
            });
          }
        }
      }
    }
    if (foundFieldId && foundRecordId) {
      const fieldsMeta = await getFieldMeta(env, token, tableId);
      let realFieldId = foundFieldId;
      for (const fm of fieldsMeta) {
        if (fm.field_name === foundFieldId || fm.field_id === foundFieldId) {
          realFieldId = fm.field_id;
          break;
        }
      }
      const extra = JSON.stringify({
        bitablePerm: {
          tableId,
          attachments: {
            [realFieldId]: {
              [foundRecordId]: [fileToken]
            }
          }
        }
      });
      const dlResp = await fetch(
        `https://open.feishu.cn/open-apis/drive/v1/medias/${fileToken}/download?extra=${encodeURIComponent(extra)}`,
        { headers: { Authorization: `Bearer ${token}` }, redirect: "follow" }
      );
      if (dlResp.ok) {
        const ct = dlResp.headers.get("Content-Type") || "";
        if (ct.includes("pdf") || ct.includes("octet-stream") || ct.includes("binary") || ct.includes("application/") || !ct) {
          return new Response(dlResp.body, {
            status: 200,
            headers: {
              "Content-Type": ct || "application/pdf",
              "Content-Disposition": 'inline; filename="resume.pdf"',
              "Access-Control-Allow-Origin": "*",
              "Cache-Control": "public, max-age=3600"
            }
          });
        }
      }
    }
    const boxUrl = `https://${env.FEISHU_HOST || "ywwlaii6ga7"}.feishu.cn/space/api/box/stream/download/all/${fileToken}?mount_node_token=${env.FEISHU_BITABLE_APP_TOKEN || FEISHU_CONFIG.appToken}&mount_point=bitable`;
    const boxResp = await fetch(boxUrl, {
      headers: {
        "Authorization": `Bearer ${token}`,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Referer": `https://${env.FEISHU_HOST || "ywwlaii6ga7"}.feishu.cn/`
      },
      redirect: "follow"
    });
    if (boxResp.ok) {
      const ct = boxResp.headers.get("Content-Type") || "";
      if (ct.includes("pdf") || ct.includes("octet-stream") || ct.includes("binary") || ct.includes("application/") || !ct) {
        return new Response(boxResp.body, {
          status: 200,
          headers: {
            "Content-Type": ct || "application/pdf",
            "Content-Disposition": 'inline; filename="resume.pdf"',
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "public, max-age=3600"
          }
        });
      }
    }
    console.error(`[FeishuAPI] \u6240\u6709\u4E0B\u8F7D\u65B9\u6CD5\u5931\u8D25 fileToken=${fileToken}`);
    return null;
  } catch (e) {
    console.error(`[FeishuAPI] download attachment error: ${e.message}`);
    return null;
  }
}
async function getFieldMeta(env, token, tableId) {
  try {
    const appToken = env.FEISHU_BITABLE_APP_TOKEN || FEISHU_CONFIG.appToken;
    const url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/fields`;
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await resp.json();
    if (data.data && data.data.items) {
      return data.data.items;
    }
    console.warn(`getFieldMeta fallback: ${JSON.stringify(data)}`);
    const records = await getBitableRecords(env, token, tableId);
    if (records.length > 0) {
      return Object.keys(records[0].fields || {}).map((name) => ({ field_name: name }));
    }
    return [];
  } catch (err) {
    console.warn(`getFieldMeta error: ${err}`);
    return [];
  }
}
async function getBitableRecords(env, token, tableId) {
  const appToken = env.FEISHU_BITABLE_APP_TOKEN || FEISHU_CONFIG.appToken;
  const allRecords = [];
  let pageToken = null;
  do {
    let url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records?page_size=500`;
    if (pageToken) url += `&page_token=${pageToken}`;
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await resp.json();
    if (!data.data) {
      throw new Error(`Failed to get records: ${JSON.stringify(data)}`);
    }
    allRecords.push(...data.data.items || []);
    pageToken = data.data.page_token || null;
    if (!data.data.has_more) break;
  } while (pageToken);
  return allRecords;
}
function buildApprovedCardContent(name, posName) {
  return {
    config: { wide_screen_mode: true },
    header: {
      title: { tag: "plain_text", content: `\u2705 \u5DF2\u5165\u5E93: ${name} (${posName})` },
      template: "green"
    },
    elements: [
      { tag: "div", text: { tag: "lark_md", content: `\u5019\u9009\u4EBA **${name}** \u7ECF\u8FC7 AI \u8BC4\u4F30\u540E\u5DF2\u88AB HR \u786E\u8BA4\u5165\u5E93\u3002` } },
      { tag: "hr" },
      { tag: "note", elements: [{ tag: "plain_text", content: "\u6B64\u5019\u9009\u4EBA\u5DF2\u8FDB\u5165\u4EBA\u624D\u5E93\uFF0C\u9762\u8BD5\u5B98\u53EF\u67E5\u770B\u8BE6\u60C5\u5B89\u6392\u9762\u8BD5\u3002" }] }
    ]
  };
}
function buildRejectedCardContent(name, posName) {
  return {
    config: { wide_screen_mode: true },
    header: {
      title: { tag: "plain_text", content: `\u274C \u5DF2\u6DD8\u6C70: ${name} (${posName})` },
      template: "red"
    },
    elements: [
      { tag: "div", text: { tag: "lark_md", content: `\u5019\u9009\u4EBA **${name}** \u7ECF\u8FC7 AI \u8BC4\u4F30\u540E\u5DF2\u88AB HR \u6DD8\u6C70\u3002` } },
      { tag: "hr" },
      { tag: "note", elements: [{ tag: "plain_text", content: "\u6B64\u5019\u9009\u4EBA\u4E0D\u5EFA\u8BAE\u8FDB\u5165\u540E\u7EED\u6D41\u7A0B\u3002" }] }
    ]
  };
}
async function updateFeishuCard(env, messageId, status, name) {
  const token = await getFeishuToken(env);
  const cardContent = status === "approved" ? buildApprovedCardContent(name, "") : buildRejectedCardContent(name, "");
  const resp = await fetch(`https://open.feishu.cn/open-apis/im/v1/messages/${messageId}`, {
    method: "PATCH",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      msg_type: "interactive",
      content: JSON.stringify(cardContent)
    })
  });
  const data = await resp.json();
  if (data.code !== 0) console.error(`[FeishuCard] \u66F4\u65B0\u5931\u8D25: ${JSON.stringify(data)}`);
}
async function createFeishuBitableRecord(token, appToken, tableId, fields) {
  try {
    const resp = await fetch(`https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${tableId}/records`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ fields })
    });
    const data = await resp.json();
    if (data.code !== 0) throw new Error(JSON.stringify(data));
    return data.data.record.record_id;
  } catch (e) {
    console.error(`[Bitable] \u521B\u5EFA\u8BB0\u5F55\u5931\u8D25: ${e.message}`);
    return null;
  }
}
async function pushCandidateToGroup(env, record) {
  const chatId = FEISHU_CONFIG.recruitmentGroupChatId;
  if (!chatId || !record) return;
  try {
    const token = await getFeishuToken(env);
    const posName = record.mapped_position || record.position_applied?.split("_")[0] || "\u672A\u77E5\u5C97\u4F4D";
    const analysis = (record.ai_analysis || "").substring(0, 800);
    const posNameShort = posName.length > 20 ? posName.substring(0, 20) + "\u2026" : posName;
    const cardContent = {
      config: { wide_screen_mode: true },
      header: {
        title: { tag: "plain_text", content: `\u{1F195} \u65B0\u5019\u9009\u4EBA: ${record.candidate_name}` },
        template: "indigo"
      },
      elements: [
        {
          tag: "div",
          text: {
            tag: "lark_md",
            content: `**\u59D3\u540D\uFF1A** ${record.candidate_name}
**\u5C97\u4F4D\uFF1A** ${posName}
**\u5E74\u9F84\uFF1A** ${record.age || "\u672A\u77E5"} | **\u5B66\u5386\uFF1A** ${record.education || "\u672A\u77E5"}
**\u57CE\u5E02\uFF1A** ${record.city || "\u672A\u77E5"}
**\u5339\u914D\u5EA6\uFF1A** ${record.match_score || "-"}/5`
          }
        },
        { tag: "hr" },
        {
          tag: "div",
          text: { tag: "lark_md", content: `**AI \u8BC4\u4F30\u6458\u8981\uFF1A**
${analysis || "\uFF08\u65E0\u5206\u6790\u5185\u5BB9\uFF09"}` }
        },
        { tag: "hr" },
        {
          tag: "note",
          elements: [{ tag: "plain_text", content: `\u7CFB\u7EDF\u81EA\u52A8\u63A8\u9001 | ${(/* @__PURE__ */ new Date()).toLocaleString("zh-CN")}` }]
        }
      ]
    };
    await sendFeishuMessageToChat(token, chatId, cardContent);
    console.log(`[GroupPush] \u2705 \u5DF2\u63A8\u9001 ${record.candidate_name} \u5230\u62DB\u8058\u7FA4`);
  } catch (e) {
    console.error(`[GroupPush] \u63A8\u9001\u5931\u8D25: ${e.message}`);
  }
}
app.post("/api/feishu/card-action", async (c) => {
  try {
    const body = await c.req.json();
    const action = body?.action;
    if (!action?.value) {
      return c.json({ code: 0, msg: "success", data: { toast: { type: "error", content: "\u65E0\u6548\u6570\u636E" } } });
    }
    const v = action.value;
    const actionType = v.action;
    const recordId = v.record_id;
    const candidateName = v.name || "\u672A\u77E5";
    console.log(`[CardCallback] ${actionType} - ${candidateName} (${recordId})`);
    const record = await c.env.DB.prepare("SELECT * FROM resume_screening_queue WHERE id = ?").bind(recordId).first();
    if (!record) {
      return c.json({ code: 0, msg: "success", data: { toast: { type: "error", content: "\u8BB0\u5F55\u4E0D\u5B58\u5728" } } });
    }
    if (record.status !== "pending") {
      return c.json({ code: 0, msg: "success", data: { toast: { type: "warning", content: "\u5DF2\u5904\u7406\u8FC7" } } });
    }
    await c.env.DB.prepare(
      "UPDATE resume_screening_queue SET status = 'processing', feishu_processed_at = ? WHERE id = ?"
    ).bind(now(), recordId).run();
    const posName = record.mapped_position || record.position_applied?.split("_")[0] || "\u672A\u77E5\u5C97\u4F4D";
    if (actionType === "store") {
      c.executionCtx.waitUntil((async () => {
        try {
          const token = await getFeishuToken(c.env);
          const appToken = c.env.FEISHU_BITABLE_APP_TOKEN || FEISHU_CONFIG.appToken;
          const talentTableId = c.env.FEISHU_TALENT_TABLE_ID || FEISHU_CONFIG.talentTableId;
          let fileToken = null;
          if (record.resume_id && FEISHU_CONFIG.driveFolderToken) {
            const resume = await c.env.DB.prepare("SELECT file_path, raw_text FROM resumes WHERE id = ?").bind(record.resume_id).first();
          }
          const bitableFields = {
            "\u59D3\u540D": record.candidate_name || "\u672A\u77E5",
            "\u5E74\u9F84": record.age || null,
            "\u6027\u522B": record.gender || null,
            "\u5B66\u5386": record.education || null,
            "\u9762\u8BD5\u5C97\u4F4D": record.position_applied || null,
            "\u62DB\u8058\u5C97\u4F4D": posName,
            "\u57CE\u5E02": record.city || null,
            "AI\u7B80\u5386\u8BC4\u4F30": record.ai_analysis || "",
            "AI\u7B80\u5386\u521D\u7B5B\u7ED3\u679C": "\u5DF2\u5165\u5E93"
          };
          await createFeishuBitableRecord(token, appToken, talentTableId, bitableFields);
          await c.env.DB.prepare(
            "UPDATE resume_screening_queue SET status = 'approved', ai_result = 'shortlisted', updated_at = ? WHERE id = ?"
          ).bind(now(), recordId).run();
          if (record.feishu_card_msg_id) {
            await updateFeishuCard(c.env, record.feishu_card_msg_id, "approved", candidateName);
          }
          const updated = await c.env.DB.prepare("SELECT * FROM resume_screening_queue WHERE id = ?").bind(recordId).first();
          await pushCandidateToGroup(c.env, updated);
          console.log(`[CardCallback] \u2705 ${candidateName} \u5DF2\u5165\u5E93`);
        } catch (e) {
          console.error(`[CardCallback] \u5165\u5E93\u5F02\u5E38: ${e.message}`);
          await c.env.DB.prepare("UPDATE resume_screening_queue SET status = 'pending' WHERE id = ?").bind(recordId).run();
        }
      })());
      return c.json({
        code: 0,
        msg: "success",
        data: { toast: { type: "success", content: `${candidateName} \u6B63\u5728\u5165\u5E93...` } }
      });
    } else {
      c.executionCtx.waitUntil((async () => {
        try {
          const token = await getFeishuToken(c.env);
          await c.env.DB.prepare(
            "UPDATE resume_screening_queue SET status = 'rejected', ai_result = 'rejected', updated_at = ? WHERE id = ?"
          ).bind(now(), recordId).run();
          if (record.feishu_card_msg_id) {
            await updateFeishuCard(c.env, record.feishu_card_msg_id, "rejected", candidateName);
          }
        } catch (e) {
          console.error(`[CardCallback] \u6DD8\u6C70\u5F02\u5E38: ${e.message}`);
          await c.env.DB.prepare("UPDATE resume_screening_queue SET status = 'pending' WHERE id = ?").bind(recordId).run();
        }
      })());
      return c.json({
        code: 0,
        msg: "success",
        data: { toast: { type: "success", content: `${candidateName} \u5DF2\u6DD8\u6C70` } }
      });
    }
  } catch (err) {
    console.error(`[CardCallback] \u9519\u8BEF: ${err.message}`);
    return c.json({ code: 0, msg: "success", data: { toast: { type: "error", content: "\u670D\u52A1\u5668\u9519\u8BEF" } } });
  }
});
app.post("/api/feishu/event-callback", async (c) => {
  try {
    const body = await c.req.json();
    if (body.type === "url_verification") {
      return c.json({ challenge: body.challenge });
    }
    const header = body.header;
    const eventType = header?.event_type;
    const event = body.event || {};
    if (eventType === "im.message.receive_v1") {
      const message = event.message || {};
      const sender = event.sender || {};
      const chatType = message.chat_type;
      const msgType = message.msg_type;
      const msgId = message.message_id;
      const chatId = message.chat_id;
      const textContent = message.content ? (() => {
        try {
          return JSON.parse(message.content);
        } catch {
          return { text: message.content };
        }
      })() : {};
      const replyText = async (text) => {
        try {
          const token = await getFeishuToken(c.env);
          await fetch(`https://open.feishu.cn/open-apis/im/v1/messages/${msgId}/reply`, {
            method: "POST",
            headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ content: JSON.stringify({ text }), msg_type: "text" })
          });
        } catch {
        }
      };
      if (chatType === "group" && msgType === "text") {
        const msgText = textContent.text || "";
        const evalMatch = msgText.match(/评价(.+?)\s*(?:沟通|协调|专业|技术|管理|团队|表达|学习)(?:能力)?(\d+)/);
        if (evalMatch) {
          const name = evalMatch[1].trim();
          const score = parseInt(evalMatch[2]);
          await c.env.DB.prepare(
            `INSERT INTO department_reviews (id, candidate_name, reviewer_id, reviewer_name, score, comment, is_completed, created_at)
             VALUES (?,?,?,?,?,?,?,?)`
          ).bind(uuid(), name, sender.sender_id?.open_id || "unknown", sender.sender_id?.open_id || "unknown", score, msgText, 1, now()).run();
          await replyText(`\u2705 \u5DF2\u8BB0\u5F55\u5BF9 ${name} \u7684\u8BC4\u4EF7`);
        }
        if (msgText.includes("\u7EDF\u8BA1") || msgText.includes("\u8FDB\u5EA6")) {
          const pending = await c.env.DB.prepare("SELECT COUNT(*) as c FROM resume_screening_queue WHERE status='pending'").first();
          const approved = await c.env.DB.prepare("SELECT COUNT(*) as c FROM resume_screening_queue WHERE status='approved'").first();
          await replyText(
            `\u{1F4CA} \u62DB\u8058\u7EDF\u8BA1
\u5DF2\u5165\u5E93: ${approved?.c || 0} \u4EBA
\u5F85\u5BA1\u6838: ${pending?.c || 0} \u4EBA`
          );
        }
        if (msgText.includes("\u5E2E\u52A9") || msgText.includes("help") || msgText.includes("\u529F\u80FD")) {
          await replyText(
            `\u{1F916} \u62DB\u8058\u52A9\u624B\u53EF\u7528\u529F\u80FD\uFF1A
\u2022 \u8BC4\u4EF7[\u59D3\u540D] [\u80FD\u529B][\u5206\u6570] \u2014 \u9762\u8BD5\u8BC4\u4EF7
\u2022 \u7EDF\u8BA1/\u8FDB\u5EA6 \u2014 \u67E5\u770B\u62DB\u8058\u6570\u636E
\u2022 \u5E2E\u52A9/help \u2014 \u663E\u793A\u6B64\u5E2E\u52A9`
          );
        }
      } else if (chatType === "p2p" && msgType === "text") {
        const msgText = textContent.text || "";
        if (msgText.includes("\u7EDF\u8BA1") || msgText.includes("\u8FDB\u5EA6")) {
          const approved = await c.env.DB.prepare("SELECT COUNT(*) as c FROM resume_screening_queue WHERE status='approved'").first();
          const pending = await c.env.DB.prepare("SELECT COUNT(*) as c FROM resume_screening_queue WHERE status='pending'").first();
          await replyText(`\u{1F4CA} \u62DB\u8058\u7EDF\u8BA1
\u5DF2\u5165\u5E93: ${approved?.c || 0} \u4EBA
\u5F85\u5BA1\u6838: ${pending?.c || 0} \u4EBA`);
        } else {
          await replyText(`\u{1F916} \u4F60\u597D\uFF01\u6211\u662F\u62DB\u8058\u52A9\u624B\u3002
\u5728\u7FA4\u4E2D @\u6211 \u53EF\u8FDB\u884C\u9762\u8BD5\u8BC4\u4EF7\u6216\u67E5\u770B\u7EDF\u8BA1\u6570\u636E\u3002`);
        }
      }
      return c.json({ code: 0, msg: "success" });
    }
    if (eventType === "im.menu.action") {
      const menuValue = event?.action?.value;
      const chatId = event?.chat_id;
      const openId = event?.operator?.operator_id?.open_id;
      console.log(`[Bot] \u83DC\u5355\u70B9\u51FB: ${menuValue}`);
      if (menuValue && chatId) {
        const reply = async (text) => {
          try {
            const token = await getFeishuToken(c.env);
            const cardContent = {
              config: { wide_screen_mode: true },
              header: { title: { tag: "plain_text", content: "\u{1F916} \u62DB\u8058\u52A9\u624B" }, template: "blue" },
              elements: [{ tag: "div", text: { tag: "lark_md", content: text } }]
            };
            await sendFeishuMessageToChat(token, chatId, cardContent);
          } catch {
          }
        };
        switch (menuValue) {
          case "pending_list":
            const pending = await c.env.DB.prepare("SELECT candidate_name, position_applied FROM resume_screening_queue WHERE status='pending' LIMIT 10").all();
            const names = (pending.results || []).map((r) => `\u2022 ${r.candidate_name} - ${r.position_applied || "\u672A\u77E5"}`).join("\n") || "\u6682\u65E0";
            await reply(`\u{1F4CB} **\u5F85\u5BA1\u6838\u5217\u8868**
${names}`);
            break;
          case "stats_progress":
            const pend = await c.env.DB.prepare("SELECT COUNT(*) as c FROM resume_screening_queue WHERE status='pending'").first();
            const appr = await c.env.DB.prepare("SELECT COUNT(*) as c FROM resume_screening_queue WHERE status='approved'").first();
            await reply(`\u{1F4CA} **\u62DB\u8058\u8FDB\u5EA6**
\u5DF2\u5165\u5E93: ${appr?.c || 0} \u4EBA
\u5F85\u5BA1\u6838: ${pend?.c || 0} \u4EBA`);
            break;
          case "help":
            await reply(`\u{1F916} **\u62DB\u8058\u52A9\u624B\u529F\u80FD**
\u2022 \u8BC4\u4EF7[\u59D3\u540D] [\u80FD\u529B][\u5206\u6570]
\u2022 \u7EDF\u8BA1\u67E5\u770B\u6570\u636E
\u2022 @\u6211\u4F7F\u7528`);
            break;
          default:
            await reply(`\u6536\u5230\u6307\u4EE4: ${menuValue}`);
        }
      }
      return c.json({ code: 0, msg: "success" });
    }
    return c.json({ code: 0, msg: "success" });
  } catch {
    return c.json({ code: 0, msg: "success" });
  }
});
app.post("/api/cron/daily-report", async (c) => {
  try {
    const today = /* @__PURE__ */ new Date();
    const dateStr = today.toISOString().split("T")[0];
    const tableId = getBitableTableId(c.env, "talent");
    const records = await bitableListRecords(c.env, tableId);
    const items = records.map(parseTalentRecord);
    const { results: allScreening } = await c.env.DB.prepare(
      "SELECT resume_id, status FROM resume_screening_queue WHERE resume_id IS NOT NULL"
    ).all();
    const statusMap = /* @__PURE__ */ new Map();
    for (const s of allScreening || []) {
      statusMap.set(s.resume_id, s.status);
    }
    const ownerMap = /* @__PURE__ */ new Map();
    for (const item of items) {
      let bizOwner = item.biz_owner || "\u5F85\u5206\u914D";
      if (Array.isArray(bizOwner)) {
        const firstTarget = bizOwner[0];
        if (typeof firstTarget === "object") bizOwner = firstTarget.text || firstTarget.name || firstTarget.label || "\u5F85\u5206\u914D";
        else bizOwner = String(firstTarget) || "\u5F85\u5206\u914D";
      }
      if (!bizOwner || bizOwner === "\u5F85\u5206\u914D" || bizOwner === "" || bizOwner === '""') bizOwner = "\u5F85\u5206\u914D";
      if (!ownerMap.has(bizOwner)) {
        ownerMap.set(bizOwner, { total: 0, pending: 0, approved: 0, rejected: 0 });
      }
      const stat = ownerMap.get(bizOwner);
      stat.total++;
      const dbStatus = statusMap.get(item.id);
      if (dbStatus === "approved") stat.approved++;
      else if (dbStatus === "rejected") stat.rejected++;
      else if (dbStatus === "pending") stat.pending++;
      else {
        const hrReview = item.hr_review || "";
        const screeningResult = item.screening_result || "";
        if (hrReview === "\u4E0D\u901A\u8FC7" || screeningResult === "\u6DD8\u6C70") stat.rejected++;
        else if (hrReview === "\u901A\u8FC7" || screeningResult === "\u901A\u8FC7" || item.status === "approved") stat.approved++;
        else stat.pending++;
      }
    }
    const ownerStats = [];
    let grandTotal = 0, grandPending = 0, grandApproved = 0, grandRejected = 0;
    const sortedOwners = [...ownerMap.entries()].sort((a, b) => b[1].total - a[1].total);
    for (const [name, stat] of sortedOwners) {
      ownerStats.push({ name, ...stat });
      grandTotal += stat.total;
      grandPending += stat.pending;
      grandApproved += stat.approved;
      grandRejected += stat.rejected;
    }
    let aiSummary = "(\u6682\u65E0)";
    try {
      const statsForAi = {
        \u65E5\u671F: dateStr,
        \u8D1F\u8D23\u4EBA\u7EDF\u8BA1: ownerStats.map((s) => `${s.name}: \u603B${s.total}\u4EBA(\u5F85\u5904\u7406${s.pending}, \u5DF2\u5165\u5E93${s.approved}, \u6DD8\u6C70${s.rejected})`),
        \u603B\u8BA1: `\u603B${grandTotal}\u4EBA(\u5F85\u5904\u7406${grandPending}, \u5DF2\u5165\u5E93${grandApproved}, \u6DD8\u6C70${grandRejected})`
      };
      aiSummary = await callAI(
        c.env,
        "\u4F60\u662F\u62DB\u8058\u6570\u636E\u5206\u6790\u4E13\u5BB6\u3002\u6839\u636E\u6309\u8D1F\u8D23\u4EBA\u5206\u7EC4\u7684\u62DB\u8058\u7EDF\u8BA1\u6570\u636E\u751F\u6210\u4E00\u4EFD\u7B80\u6D01\u7684\u65E5\u62A5\u6458\u8981\uFF08\u4E2D\u6587\uFF09\uFF0C\u5305\u542B\uFF1A\u6574\u4F53\u8FDB\u5C55\u6982\u8FF0\u3001\u5404\u8D1F\u8D23\u4EBA\u8868\u73B0\u5BF9\u6BD4\u3001\u5173\u952E\u6307\u6807\u5206\u6790\u3001\u98CE\u9669\u63D0\u793A\u3001\u660E\u65E5\u5EFA\u8BAE\u3002\u63A7\u5236\u5728200\u5B57\u4EE5\u5185\u3002\u76F4\u63A5\u8F93\u51FA\u7EAF\u6587\u5B57\uFF0C\u4E0D\u8981markdown\u683C\u5F0F\u3002",
        `\u65E5\u671F\uFF1A${dateStr}
\u7EDF\u8BA1\uFF1A${JSON.stringify(statsForAi, null, 2)}`
      );
    } catch {
    }
    const elements = [];
    elements.push({
      tag: "div",
      text: {
        tag: "lark_md",
        content: `\u{1F4C5} **\u65E5\u671F\uFF1A${dateStr}**`
      }
    });
    const headerCells = [
      { tag: "markdown", content: "**\u8D1F\u8D23\u4EBA**", width: "90px", column_span: 1 },
      { tag: "markdown", content: "**\u603B\u7B80\u5386**", width: "80px", column_span: 1 },
      { tag: "markdown", content: "**\u5F85\u5904\u7406**", width: "80px", column_span: 1 },
      { tag: "markdown", content: "**\u5DF2\u5165\u5E93**", width: "80px", column_span: 1 },
      { tag: "markdown", content: "**\u5DF2\u6DD8\u6C70**", width: "80px", column_span: 1 }
    ];
    const headerRow = { tag: "column_set", flex_mode: "none", background_style: "grey", columns: headerCells };
    const statRows = ownerStats.map((s) => ({
      tag: "column_set",
      flex_mode: "none",
      columns: [
        { tag: "markdown", content: s.name, width: "90px", column_span: 1 },
        { tag: "markdown", content: `**${s.total}**`, width: "80px", column_span: 1 },
        { tag: "markdown", content: s.pending > 0 ? `\u26A0\uFE0F **${s.pending}**` : `${s.pending}`, width: "80px", column_span: 1 },
        { tag: "markdown", content: `\u2705 **${s.approved}**`, width: "80px", column_span: 1 },
        { tag: "markdown", content: s.rejected > 0 ? `\u274C ${s.rejected}` : `${s.rejected}`, width: "80px", column_span: 1 }
      ]
    }));
    statRows.push({
      tag: "column_set",
      flex_mode: "none",
      background_style: "grey",
      columns: [
        { tag: "markdown", content: `**\u5408\u8BA1**`, width: "90px", column_span: 1 },
        { tag: "markdown", content: `**${grandTotal}**`, width: "80px", column_span: 1 },
        { tag: "markdown", content: grandPending > 0 ? `\u26A0\uFE0F **${grandPending}**` : `**${grandPending}**`, width: "80px", column_span: 1 },
        { tag: "markdown", content: `\u2705 **${grandApproved}**`, width: "80px", column_span: 1 },
        { tag: "markdown", content: `\u274C **${grandRejected}**`, width: "80px", column_span: 1 }
      ]
    });
    elements.push(headerRow, ...statRows);
    elements.push({ tag: "hr" });
    elements.push({
      tag: "div",
      text: {
        tag: "lark_md",
        content: `\u{1F916} **AI \u6458\u8981**
${aiSummary}`
      }
    });
    elements.push({ tag: "hr" });
    elements.push({
      tag: "note",
      elements: [{ tag: "plain_text", content: `AI \u667A\u80FD\u62DB\u8058\u7CFB\u7EDF \xB7 ${today.toLocaleString("zh-CN")}` }]
    });
    const cardContent = {
      config: { wide_screen_mode: true },
      header: {
        title: { tag: "plain_text", content: `\u{1F4CA} \u62DB\u8058\u65E5\u62A5 ${dateStr}` },
        template: "blue"
      },
      elements
    };
    const chatId = FEISHU_CONFIG.recruitmentGroupChatId;
    if (chatId) {
      const token = await getFeishuToken(c.env);
      await sendFeishuMessageToChat(token, chatId, cardContent);
    }
    return c.json({
      ok: true,
      data: {
        date: dateStr,
        owners: ownerStats,
        total: { grandTotal, grandPending, grandApproved, grandRejected },
        aiSummary,
        _debug: (debugRows || []).map((r) => ({
          name: r.candidate_name,
          bizOwnerInRaw: r.pd ? r.pd.substring(0, 200) : "null"
        }))
      }
    });
  } catch (err) {
    return c.json({ ok: false, detail: `\u751F\u6210\u65E5\u62A5\u5931\u8D25: ${err.message}` }, 500);
  }
});
app.post("/api/cron/interview-reminder", async (c) => {
  try {
    const pending = await c.env.DB.prepare(
      "SELECT COUNT(*) as c FROM resume_screening_queue WHERE status = 'pending'"
    ).first();
    const chatId = FEISHU_CONFIG.recruitmentGroupChatId;
    if (chatId && (pending?.c || 0) > 0) {
      const token = await getFeishuToken(c.env);
      const cardContent = {
        config: { wide_screen_mode: true },
        header: {
          title: { tag: "plain_text", content: `\u23F0 \u9762\u8BD5\u63D0\u9192` },
          template: "orange"
        },
        elements: [
          {
            tag: "div",
            text: {
              tag: "lark_md",
              content: `\u5F53\u524D\u8FD8\u6709 **${pending.c}** \u4F4D\u5019\u9009\u4EBA\u5F85\u5BA1\u6838\u5904\u7406\uFF0C\u8BF7\u53CA\u65F6\u5B89\u6392\u9762\u8BD5\u3002`
            }
          },
          {
            tag: "note",
            elements: [{ tag: "plain_text", content: `\u7CFB\u7EDF\u81EA\u52A8\u63D0\u9192 | ${(/* @__PURE__ */ new Date()).toLocaleString("zh-CN")}` }]
          }
        ]
      };
      await sendFeishuMessageToChat(token, chatId, cardContent);
    }
    return c.json({ ok: true, pending: pending?.c || 0 });
  } catch (err) {
    return c.json({ ok: false, detail: `\u53D1\u9001\u63D0\u9192\u5931\u8D25: ${err.message}` }, 500);
  }
});
function buildInterviewerCard(name, position, city, analysis, operatorName) {
  const summary = (analysis || "").substring(0, 500);
  return {
    config: { wide_screen_mode: true },
    header: {
      title: { tag: "plain_text", content: `\u{1F195} \u65B0\u5019\u9009\u4EBA\u5F85\u5BA1\u9605: ${name}` },
      template: "blue"
    },
    elements: [
      {
        tag: "div",
        text: { tag: "lark_md", content: `**\u5019\u9009\u4EBA\uFF1A** ${name}
**\u5C97\u4F4D\uFF1A** ${position}
**\u57CE\u5E02\uFF1A** ${city || "\u672A\u77E5"}` }
      },
      { tag: "hr" },
      {
        tag: "div",
        text: { tag: "lark_md", content: summary || "\uFF08\u65E0 AI \u5206\u6790\u5185\u5BB9\uFF09" }
      },
      { tag: "hr" },
      {
        tag: "note",
        elements: [{ tag: "plain_text", content: `${operatorName || "\u7CFB\u7EDF"} \u63A8\u8350 | AI \u667A\u80FD\u9762\u8BD5\u7CFB\u7EDF` }]
      }
    ]
  };
}
app.get("/api/feishu/contacts", authMiddleware, async (c) => {
  try {
    const token = await getFeishuToken(c.env);
    const result = { groups: [], users: [] };
    try {
      const chatsResp = await fetch("https://open.feishu.cn/open-apis/im/v1/chats?page_size=30", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const chatsData = await chatsResp.json();
      if (chatsData.code === 0 && chatsData.data?.items) {
        result.groups = chatsData.data.items.map((g) => ({
          id: g.chat_id,
          name: g.name || "(\u672A\u547D\u540D\u7FA4\u804A)",
          avatar: g.avatar || ""
        }));
      }
    } catch {
    }
    try {
      const { results } = await c.env.DB.prepare(
        "SELECT name, open_id, department, email FROM feishu_contacts ORDER BY name ASC"
      ).all();
      if (results?.length > 0) {
        result.users = results.map((u) => ({
          id: u.open_id,
          name: u.name,
          department: u.department,
          email: u.email
        }));
      } else {
        const users = await c.env.DB.prepare(
          "SELECT full_name, feishu_open_id, role FROM users WHERE feishu_open_id IS NOT NULL AND feishu_open_id != ''"
        ).all();
        if (users.results) {
          result.users = users.results.map((u) => ({
            id: u.feishu_open_id,
            name: u.full_name,
            role: u.role
          }));
        }
      }
    } catch {
    }
    const hrId = FEISHU_CONFIG.defaultHrOpenId || "";
    if (hrId && !result.users.some((u) => u.id === hrId)) {
      result.users.push({ id: hrId, name: "\u9ED8\u8BA4HR", role: "hr" });
    }
    return c.json({ ok: true, ...result });
  } catch (e) {
    return c.json({ ok: false, detail: e.message }, 500);
  }
});
async function sendFeishuMessageToChat(token, chatId, cardContent) {
  const resp = await fetch("https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=chat_id", {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      receive_id: chatId,
      msg_type: "interactive",
      content: JSON.stringify(cardContent)
    })
  });
  const data = await resp.json();
  if (data.code !== 0) throw new Error(`\u53D1\u9001\u7FA4\u6D88\u606F\u5931\u8D25: ${JSON.stringify(data)}`);
  return data.data;
}
async function sendFeishuMessageToUser(token, openId, cardContent) {
  const resp = await fetch("https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=open_id", {
    method: "POST",
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      receive_id: openId,
      msg_type: "interactive",
      content: JSON.stringify(cardContent)
    })
  });
  const data = await resp.json();
  if (data.code !== 0) throw new Error(`\u53D1\u9001\u7528\u6237\u6D88\u606F\u5931\u8D25: ${JSON.stringify(data)}`);
  return data.data;
}
async function downloadAndExtractFromFeishu(env, resumeId, candidateName, fields) {
  let fileToken = "", tmpUrl = "";
  for (const [fieldName, fieldValue] of Object.entries(fields)) {
    if (Array.isArray(fieldValue) && fieldValue.length > 0) {
      const item = fieldValue[0];
      if (item && typeof item === "object" && item.file_token) {
        fileToken = item.file_token;
        tmpUrl = item.tmp_url || "";
        break;
      }
      if (item && typeof item === "object" && item.link && item.link.includes("/download/all/")) {
        const linkMatch = item.link.match(/\/download\/all\/([^\/\?]+)/);
        if (linkMatch) {
          fileToken = linkMatch[1];
          tmpUrl = item.link;
          break;
        }
      }
    }
  }
  if (!fileToken) return null;
  try {
    const resp = await downloadFeishuAttachment(env, fileToken, tmpUrl);
    if (!resp) return null;
    const blob = await resp.clone().arrayBuffer();
    const b64 = bufToB64(blob);
    try {
      await env.DB.prepare(
        "INSERT OR REPLACE INTO resume_files (id, kv_key, file_name, file_size, content, created_at) VALUES (?, ?, ?, ?, ?, ?)"
      ).bind(resumeId, "import_" + fileToken, candidateName + ".pdf", blob.byteLength, b64, (/* @__PURE__ */ new Date()).toISOString()).run();
    } catch {
    }
    const base64Content = b64.substring(0, 1e5);
    const extraction = await callAI(
      env,
      "You are a PDF text extractor. Extract ALL readable text from this base64 PDF content. Return ONLY the extracted text, no explanations.",
      "Extract resume text from this base64 PDF (" + candidateName + ".pdf):\n\n" + base64Content,
      "deepseek-chat"
    );
    if (extraction && extraction.length > 50) {
      await env.DB.prepare("UPDATE resumes SET raw_text = ? WHERE id = ?").bind(extraction, resumeId).run();
      return extraction;
    }
  } catch {
  }
  return null;
}
async function getResumeText(env, candidateName) {
  try {
    const d1Row = await env.DB.prepare(
      "SELECT resume_markdown, raw_text, id FROM resumes WHERE candidate_name = ? LIMIT 1"
    ).bind(candidateName).first();
    if (d1Row?.resume_markdown) return d1Row.resume_markdown;
    if (d1Row?.raw_text) return d1Row.raw_text;
    if (d1Row?.id) {
      const fileRow = await env.DB.prepare(
        "SELECT content, file_name FROM resume_files WHERE id = ? LIMIT 1"
      ).bind(d1Row.id).first();
      if (fileRow?.content) {
        const base64Content = fileRow.content.substring(0, 1e5);
        try {
          const extraction = await callAI(
            env,
            "You are a PDF text extractor. Extract ALL readable text from this base64 PDF content. Return ONLY the extracted text, no explanations.",
            "Extract resume text from this base64 PDF (" + (fileRow.file_name || "resume.pdf") + "):\n\n" + base64Content,
            "deepseek-chat"
          );
          if (extraction && extraction.length > 50) {
            try {
              await env.DB.prepare("UPDATE resumes SET raw_text = ? WHERE id = ?").bind(extraction, d1Row.id).run();
            } catch {
            }
            return extraction;
          }
        } catch {
        }
      }
      try {
        const tableId = getBitableTableId(env, "talent");
        const records = await bitableListRecords(env, tableId);
        const rec = records.find((r) => {
          const f = r.fields || {};
          return getFirstValue(f["\u59D3\u540D"]) === candidateName;
        });
        if (rec) {
          const extracted = await downloadAndExtractFromFeishu(env, d1Row.id, candidateName, rec.fields || {});
          if (extracted) return extracted;
        }
      } catch {
      }
    }
    try {
      const tableId = getBitableTableId(env, "talent");
      const records = await bitableListRecords(env, tableId);
      const rec = records.find((r) => {
        const f = r.fields || {};
        return getFirstValue(f["\u59D3\u540D"]) === candidateName;
      });
      if (rec) {
        const f = rec.fields || {};
        const parts = [];
        if (getFirstValue(f["\u59D3\u540D"])) parts.push("\u59D3\u540D: " + getFirstValue(f["\u59D3\u540D"]));
        if (getFirstValue(f["\u6027\u522B"])) parts.push("\u6027\u522B: " + getFirstValue(f["\u6027\u522B"]));
        if (f["\u5E74\u9F84"]) parts.push("\u5E74\u9F84: " + f["\u5E74\u9F84"]);
        if (getFirstValue(f["\u5B66\u5386"])) parts.push("\u5B66\u5386: " + getFirstValue(f["\u5B66\u5386"]));
        if (getFirstValue(f["\u5B66\u6821"])) parts.push("\u5B66\u6821: " + getFirstValue(f["\u5B66\u6821"]));
        if (getFirstValue(f["\u4E13\u4E1A"])) parts.push("\u4E13\u4E1A: " + getFirstValue(f["\u4E13\u4E1A"]));
        if (getFirstValue(f["\u4F18\u52BF\u5206\u6790"])) parts.push("\n\u4F18\u52BF\u5206\u6790:\n" + getFirstValue(f["\u4F18\u52BF\u5206\u6790"]));
        if (getFirstValue(f["\u98CE\u9669\u70B9"])) parts.push("\n\u98CE\u9669\u70B9:\n" + getFirstValue(f["\u98CE\u9669\u70B9"]));
        if (parts.length > 0) return parts.join("\n");
      }
    } catch {
    }
  } catch {
  }
  return candidateName + " - \u65E0\u6CD5\u83B7\u53D6\u7B80\u5386\u539F\u6587";
}
async function notifyInterviewersForCandidate(env, token, record, operatorName) {
  const posName = record.mapped_position || record.position_applied?.split("_")[0] || "\u672A\u77E5\u5C97\u4F4D";
  try {
    const tasks = await env.DB.prepare(
      "SELECT * FROM recruitment_tasks WHERE position_name LIKE ? LIMIT 5"
    ).bind(`%${posName}%`).all();
    const taskList = tasks.results || [];
    if (taskList.length === 0) {
      console.log(`[NotifyInterviewers] \u672A\u627E\u5230 ${posName} \u7684\u62DB\u8058\u4EFB\u52A1\uFF0C\u901A\u77E5\u9ED8\u8BA4 HR`);
      const defaultOpenId = FEISHU_CONFIG.defaultHrOpenId;
      if (defaultOpenId) {
        const cardContent = buildInterviewerCard(record.candidate_name, posName, record.city, record.ai_analysis, operatorName);
        await sendFeishuMessageToUser(token, defaultOpenId, cardContent);
        console.log(`[NotifyInterviewers] \u2705 \u5DF2\u901A\u77E5\u9ED8\u8BA4 HR (${defaultOpenId})`);
      }
      return;
    }
    const notifiedNames = /* @__PURE__ */ new Set();
    for (const task of taskList) {
      let interviewers = [];
      try {
        if (typeof task.interviewers === "string") {
          interviewers = JSON.parse(task.interviewers);
        } else if (Array.isArray(task.interviewers)) {
          interviewers = task.interviewers;
        }
      } catch {
      }
      if (task.responsible_person && !interviewers.includes(task.responsible_person)) {
        interviewers.push(task.responsible_person);
      }
      for (const name of interviewers) {
        if (notifiedNames.has(name) || !name) continue;
        notifiedNames.add(name);
        let openId = "";
        let userToken = token;
        try {
          const userRow = await env.DB.prepare(
            "SELECT feishu_open_id, feishu_token FROM users WHERE full_name = ? AND feishu_open_id IS NOT NULL AND feishu_open_id != '' LIMIT 1"
          ).bind(name).first();
          if (userRow?.feishu_open_id) {
            openId = userRow.feishu_open_id;
            console.log(`[NotifyInterviewers] \u4F7F\u7528 DB \u4E2D ${name} \u7684 feishu_open_id`);
          }
          if (userRow?.feishu_token) {
            userToken = userRow.feishu_token;
            console.log(`[NotifyInterviewers] \u4F7F\u7528 ${name} \u81EA\u5DF1\u7684\u98DE\u4E66 token`);
          }
        } catch {
        }
        if (!openId) {
          const hardcoded = FEISHU_CONFIG.interviewerOpenIds;
          if (hardcoded && hardcoded[name]) {
            openId = hardcoded[name];
            console.log(`[NotifyInterviewers] \u4F7F\u7528\u786C\u7F16\u7801\u6620\u5C04\u627E\u5230 ${name} \u2192 ${openId}`);
            try {
              await env.DB.prepare(
                "UPDATE users SET feishu_open_id = ? WHERE full_name = ? AND (feishu_open_id IS NULL OR feishu_open_id = '')"
              ).bind(openId, name).run();
            } catch {
            }
          } else {
            console.warn(`[NotifyInterviewers] \u26A0 ${name} \u672A\u5728\u7CFB\u7EDF\u4E2D\u7ED1\u5B9A\u98DE\u4E66\uFF0C\u8DF3\u8FC7\u4E86\u98DE\u4E66\u901A\u77E5\u3002\u8BF7\u8BA9\u8BE5\u9762\u8BD5\u5B98\u5728\u8BBE\u7F6E\u9875\u9762\u7ED1\u5B9A\u98DE\u4E66\u8EAB\u4EFD\u3002`);
            continue;
          }
        }
        const cardContent = buildInterviewerCard(record.candidate_name, posName, record.city, record.ai_analysis, operatorName);
        await sendFeishuMessageWithFallback(env, openId, cardContent, userToken !== token ? userToken : void 0);
        console.log(`[NotifyInterviewers] \u2705 \u5DF2\u901A\u77E5 ${name} (${openId}) - ${record.candidate_name}`);
      }
    }
  } catch (e) {
    console.error(`[NotifyInterviewers] \u901A\u77E5\u5931\u8D25: ${e.message}`);
  }
}
app.post("/api/resume-screening/:id/notify-interviewers", authMiddleware, async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  const currentUser = c.get("user");
  let record;
  if (body.candidate_name) {
    record = {
      candidate_name: body.candidate_name,
      position_applied: body.position_applied || "",
      mapped_position: body.mapped_position || body.position_applied || "",
      city: body.city || ""
    };
  } else {
    record = await c.env.DB.prepare("SELECT * FROM resume_screening_queue WHERE id = ?").bind(id).first();
  }
  if (!record) return c.json({ detail: "\u8BB0\u5F55\u4E0D\u5B58\u5728" }, 404);
  try {
    const token = await getFeishuToken(c.env);
    await notifyInterviewersForCandidate(c.env, token, record, currentUser?.full_name);
    return c.json({ ok: true, message: `\u5DF2\u901A\u77E5\u5BF9\u5E94\u9762\u8BD5\u5B98: ${record.candidate_name}` });
  } catch (err) {
    return c.json({ detail: `\u901A\u77E5\u5931\u8D25: ${err.message}` }, 500);
  }
});
app.post("/api/interviews/:id/notify-interviewer", authMiddleware, async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json().catch(() => ({}));
  const currentUser = c.get("user");
  const interviewerName = body.interviewer_name || "\u675C\u96C1\u73B2";
  const candidateName = body.candidate_name || "\u8BE5\u5019\u9009\u4EBA";
  try {
    const meRow = await c.env.DB.prepare(
      "SELECT feishu_token, feishu_open_id FROM users WHERE email = ? AND feishu_token IS NOT NULL AND feishu_token != ''"
    ).bind(currentUser.email).first();
    if (!meRow?.feishu_token) {
      return c.json({ detail: "\u4F60\u8FD8\u6CA1\u7ED1\u5B9A\u98DE\u4E66\uFF0C\u8BF7\u5148\u5728\u4E2A\u4EBA\u8BBE\u7F6E\u91CC\u7ED1\u5B9A\u98DE\u4E66\u8D26\u53F7" }, 400);
    }
    const myToken = meRow.feishu_token;
    let targetOpenId = "";
    try {
      const targetRow = await c.env.DB.prepare(
        "SELECT feishu_open_id FROM users WHERE full_name = ? AND feishu_open_id IS NOT NULL AND feishu_open_id != '' LIMIT 1"
      ).bind(interviewerName).first();
      if (targetRow?.feishu_open_id) {
        targetOpenId = targetRow.feishu_open_id;
        console.log(`[NotifyInterviewer] users \u8868\u627E\u5230 ${interviewerName} \u7684 open_id`);
      }
    } catch {
    }
    if (!targetOpenId) {
      const hardcoded = FEISHU_CONFIG.interviewerOpenIds;
      if (hardcoded && hardcoded[interviewerName]) {
        targetOpenId = hardcoded[interviewerName];
        console.log(`[NotifyInterviewer] \u786C\u7F16\u7801\u6620\u5C04\u627E\u5230 ${interviewerName} \u2192 ${targetOpenId}`);
        try {
          await c.env.DB.prepare(
            "UPDATE users SET feishu_open_id = ? WHERE full_name = ? AND (feishu_open_id IS NULL OR feishu_open_id = '')"
          ).bind(targetOpenId, interviewerName).run();
        } catch {
        }
      }
    }
    if (!targetOpenId) {
      const appToken = await getFeishuToken(c.env);
      try {
        const deptResp = await fetch("https://open.feishu.cn/open-apis/contact/v3/departments?page_size=1", {
          headers: { Authorization: `Bearer ${appToken}` }
        });
        const deptData = await deptResp.json();
        if (deptData.code === 0 && deptData.data?.items?.length > 0) {
          const rootDeptId = deptData.data.items[0].open_department_id;
          let pageToken;
          mainLoop: for (let i = 0; i < 3; i++) {
            const url = `https://open.feishu.cn/open-apis/contact/v3/users/find_by_department?department_id=${rootDeptId}&page_size=50${pageToken ? `&page_token=${pageToken}` : ""}`;
            const searchResp = await fetch(url, { headers: { Authorization: `Bearer ${appToken}` } });
            const searchData = await searchResp.json();
            if (searchData.code === 0) {
              const items = searchData.data?.items || [];
              for (const u of items) {
                if (u.name === interviewerName) {
                  targetOpenId = u.open_id;
                  console.log(`[NotifyInterviewer] \u901A\u8BAF\u5F55\u627E\u5230 ${interviewerName} \u2192 ${targetOpenId}`);
                  try {
                    await c.env.DB.prepare(
                      "UPDATE users SET feishu_open_id = ? WHERE full_name = ? AND (feishu_open_id IS NULL OR feishu_open_id = '')"
                    ).bind(targetOpenId, interviewerName).run();
                  } catch {
                  }
                  break mainLoop;
                }
              }
              if (!searchData.data?.has_more) break;
              pageToken = searchData.data?.page_token;
            } else {
              break;
            }
          }
        }
      } catch (e) {
        console.warn(`[NotifyInterviewer] \u901A\u8BAF\u5F55\u641C\u7D22\u5931\u8D25: ${e.message}`);
      }
    }
    if (!targetOpenId) {
      return c.json({ detail: `\u627E\u4E0D\u5230\u9762\u8BD5\u5B98 ${interviewerName} \u7684\u98DE\u4E66 open_id\uFF0C\u8BF7\u786E\u8BA4\u8BE5\u59D3\u540D\u5728\u4F01\u4E1A\u901A\u8BAF\u5F55\u4E2D\u5B58\u5728\u6216\u5DF2\u7ED1\u5B9A\u98DE\u4E66` }, 400);
    }
    const cardContent = buildInterviewerCard(
      candidateName,
      body.position_applied || "",
      body.city || "",
      "",
      currentUser?.full_name
    );
    try {
      await sendFeishuMessageWithFallback(c.env, targetOpenId, cardContent, myToken);
      return c.json({ ok: true, message: `${currentUser.full_name || "\u4F60"} \u5DF2\u63D0\u9192\u9762\u8BD5\u5B98 ${interviewerName}: ${candidateName}` });
    } catch (err) {
      throw err;
    }
  } catch (err) {
    return c.json({ detail: `\u901A\u77E5\u5931\u8D25: ${err.message}` }, 500);
  }
});
app.get("/api", (c) => c.json({ status: "ok", service: "ai-interview-api" }));
app.post("/api/auth/sync-responsible-persons", authMiddleware, requireRole(["admin"]), async (c) => {
  try {
    const tableId = getBitableTableId(c.env, "requisition");
    const records = await bitableListRecords(c.env, tableId);
    const personMap = {};
    for (const rec of records) {
      const f = rec.fields || {};
      const title = getFirstValue(f["\u62DB\u8058\u5C97\u4F4D"]) || "";
      if (!title) continue;
      const person = getUserName(f["\u8D23\u4EFB\u4EBA"]) || "";
      if (person && !personMap[title]) {
        personMap[title] = person;
      }
    }
    let updated = 0;
    for (const [title, person] of Object.entries(personMap)) {
      await c.env.DB.prepare("UPDATE positions SET responsible_person = ? WHERE title = ?").bind(person, title).run();
      updated++;
    }
    let mapUpdated = 0;
    for (const [mappedName, person] of Object.entries(personMap)) {
      const result = await c.env.DB.prepare(
        "UPDATE position_mappings SET responsible_person = ? WHERE mapped_name = ? AND (responsible_person IS NULL OR responsible_person = ? OR responsible_person = ?)"
      ).bind(person, mappedName, "", "[object Object]").run();
      if (result.meta?.changes > 0) mapUpdated += result.meta.changes;
    }
    return c.json({
      ok: true,
      positions_updated: updated,
      mappings_updated: mapUpdated,
      persons: Object.entries(personMap).map(([t, p]) => `${t} \u2192 ${p}`)
    });
  } catch (e) {
    return c.json({ detail: "\u540C\u6B65\u5931\u8D25: " + e.message }, 500);
  }
});
app.post("/api/auth/fix-responsible-persons", authMiddleware, requireRole(["admin"]), async (c) => {
  try {
    const tableId = getBitableTableId(c.env, "requisition");
    const records = await bitableListRecords(c.env, tableId);
    const personMap = {};
    for (const rec of records) {
      const f = rec.fields || {};
      const title = getFirstValue(f["\u62DB\u8058\u5C97\u4F4D"]) || "";
      if (!title) continue;
      const person = getUserName(f["\u8D23\u4EFB\u4EBA"]) || "";
      if (person && !personMap[title]) personMap[title] = person;
    }
    let fixed = 0;
    for (const [mappedName, person] of Object.entries(personMap)) {
      const rows = await c.env.DB.prepare(
        "SELECT id FROM position_mappings WHERE mapped_name = ? LIMIT 1"
      ).bind(mappedName).all();
      for (const row of rows.results || []) {
        await c.env.DB.prepare("UPDATE position_mappings SET responsible_person = ? WHERE id = ?").bind(person, row.id).run();
        fixed++;
      }
    }
    return c.json({ ok: true, fixed, persons: Object.entries(personMap).map(([t, p]) => `${t} \u2192 ${p}`) });
  } catch (e) {
    return c.json({ detail: "\u4FEE\u590D\u5931\u8D25: " + e.message }, 500);
  }
});
function buildAIScreeningPrompt(resumeText, positionReq, extraContext) {
  let positionSections = "";
  if (positionReq) {
    const dimsText = (positionReq.capability_dimensions || []).map(
      (d) => `  - ${d.name}${d.description ? `\uFF1A${d.description}` : ""}`
    ).join("\n");
    positionSections = [
      "",
      `\u3010\u5E94\u8058\u5C97\u4F4D\uFF1A${positionReq.positionTitle}\u3011`,
      positionReq.description ? `
\u5C97\u4F4D\u804C\u8D23\uFF1A
${positionReq.description}` : "",
      positionReq.requirements ? `
\u5C97\u4F4D\u8981\u6C42\uFF1A
${positionReq.requirements}` : "",
      positionReq.personalized_requirements ? `
\u4E2A\u6027\u5316\u8981\u6C42\uFF1A
${positionReq.personalized_requirements}` : "",
      dimsText ? `
\u80FD\u529B\u7EF4\u5EA6\uFF08\u9700\u8981\u9010\u9879\u8BC4\u4F30\uFF09\uFF1A
${dimsText}` : ""
    ].filter(Boolean).join("\n");
  }
  let extraInfo = "";
  if (extraContext) {
    const parts = [];
    if (extraContext.location) parts.push(`\u5730\u70B9\uFF1A${extraContext.location}`);
    if (extraContext.salary) parts.push(`\u671F\u671B\u85AA\u8D44\uFF1A${extraContext.salary}`);
    if (extraContext.metaInfo) parts.push(`\u7B80\u5386\u5907\u6CE8\uFF1A${extraContext.metaInfo}`);
    if (parts.length > 0) {
      extraInfo = `
\u3010\u7B80\u5386\u6765\u6E90\u4FE1\u606F\u3011
${parts.join("\n")}`;
    }
  }
  const systemPrompt = `\u4F60\u662F\u4E00\u4F4D\u8D44\u6DF1\u62DB\u8058\u4E13\u5BB6\u548C\u7B80\u5386\u89E3\u6790\u52A9\u624B\u3002\u8BF7\u89E3\u6790\u4EE5\u4E0B\u7B80\u5386\u6587\u672C\uFF0C\u63D0\u53D6\u5B8C\u6574\u4FE1\u606F\u5E76\u8FDB\u884CAI\u521D\u7B5B\u8BC4\u4F30\u3002\u8FD4\u56DEJSON\u683C\u5F0F\uFF08\u4E0D\u8981\u52A0markdown\u4EE3\u7801\u5757\uFF09\uFF0C\u5305\u542B\u4E24\u90E8\u5206\uFF1A

\u7B2C\u4E00\u90E8\u5206 - \u57FA\u7840\u4FE1\u606F\uFF1A
- candidate_name: \u5019\u9009\u4EBA\u59D3\u540D\uFF08\u5168\u540D\uFF09
- gender: \u6027\u522B\uFF08\u7537/\u5973\uFF09
- age: \u5E74\u9F84\uFF08\u6570\u5B57\uFF09
- phone: \u624B\u673A\u53F7\u7801
- email: \u7535\u5B50\u90AE\u7BB1
- highest_degree: \u6700\u9AD8\u5B66\u5386
- school: \u6BD5\u4E1A\u9662\u6821
- major: \u4E13\u4E1A
- graduation_year: \u6BD5\u4E1A\u5E74\u4EFD
- years_of_experience: \u5DE5\u4F5C\u5E74\u9650\uFF08\u6570\u5B57\uFF09
- current_company: \u76EE\u524D/\u6700\u8FD1\u6240\u5728\u516C\u53F8
- current_position: \u76EE\u524D/\u6700\u8FD1\u804C\u4F4D
- salary_expectation: \u671F\u671B\u85AA\u8D44\uFF08\u5982\u679C\u6709\uFF09
- skills: \u6280\u80FD\u5217\u8868\uFF08\u6570\u7EC4\uFF09
- certifications: \u8BC1\u4E66/\u8D44\u8D28\uFF08\u6570\u7EC4\uFF09
- work_experience: \u5DE5\u4F5C\u7ECF\u5386\u6570\u7EC4\uFF0C\u6BCF\u4E2A\u5305\u542B { company, title, duration, description, achievements }
- education: \u6559\u80B2\u7ECF\u5386\u6570\u7EC4\uFF0C\u6BCF\u4E2A\u5305\u542B { school, degree, major, duration }

\u7B2C\u4E8C\u90E8\u5206 - AI\u521D\u7B5B\u8BC4\u4F30\uFF1A
- position: \u5E94\u8058\u5C97\u4F4D\uFF08\u4ECE\u6587\u4EF6\u540D\u6216\u6587\u672C\u4E2D\u63D0\u53D6\uFF09
- advantage (\u4F18\u52BF\u5206\u6790): \u7528\u4E2D\u6587\u63CF\u8FF03-5\u4E2A\u6838\u5FC3\u4F18\u52BF
- risk (\u98CE\u9669\u70B9/\u52A3\u52BF\u5206\u6790): \u7528\u4E2D\u6587\u63CF\u8FF02-4\u4E2A\u52A3\u52BF\u6216\u98CE\u9669
- match_score: \u4EBA\u5C97\u5339\u914D\u5EA6\uFF080-100\u7684\u6574\u6570\uFF09
- recommendation: \u63A8\u8350\u5EFA\u8BAE\uFF08"strongly_recommend"/"recommend"/"neutral"/"not_recommend"/"strongly_not_recommend"\uFF09
- summary: \u7EFC\u5408\u5206\u6790\u6458\u8981\uFF08\u4E2D\u6587\uFF0C2-3\u53E5\u8BDD\uFF09
- suggested_questions: \u5EFA\u8BAE\u9762\u8BD5\u95EE\u9898\uFF08\u4E2D\u6587\uFF0C3-5\u4E2A\uFF09`;
  const userPrompt = [
    `\u7B80\u5386\u6587\u672C\uFF08\u8BF7\u63D0\u53D6\u5B8C\u6574\u4FE1\u606F\uFF09\uFF1A
${resumeText}`,
    positionSections,
    extraInfo
  ].filter(Boolean).join("\n");
  return { systemPrompt, userPrompt };
}
async function callAIScreening(env, resumeText, positionReq, extraContext) {
  const { systemPrompt, userPrompt } = buildAIScreeningPrompt(resumeText, positionReq || null, extraContext);
  const result = await callAI(env, systemPrompt, userPrompt);
  if (!result) return null;
  let parsed;
  try {
    parsed = extractJSON(result);
  } catch {
    return { raw_response: result };
  }
  const flattened = {};
  for (const [k, v] of Object.entries(parsed)) {
    if (typeof v === "object" && v !== null && !Array.isArray(v)) {
      Object.assign(flattened, v);
    } else {
      flattened[k] = v;
    }
  }
  return { ...parsed, ...flattened };
}
app.post("/api/resumes/auto-evaluate", authMiddleware, async (c) => {
  try {
    const body = await c.req.json();
    const candidateName = body.candidate_name || "";
    const positionName = body.position || "";
    if (!candidateName) return c.json({ detail: "\u9700\u8981\u63D0\u4F9B\u5019\u9009\u4EBA\u59D3\u540D" }, 400);
    const resumeText = await getResumeText(c.env, candidateName);
    if (resumeText.length < 10) return c.json({ detail: "\u65E0\u6CD5\u83B7\u53D6\u7B80\u5386\u539F\u6587" }, 400);
    let effectivePosition = positionName;
    let filenameInfo = parseFilenameInfo(candidateName);
    if (!effectivePosition) {
      effectivePosition = filenameInfo.position;
    }
    const positionReq = effectivePosition ? await getPositionRequirements(c.env, effectivePosition) : null;
    const evalResult = await callAIScreening(c.env, resumeText, positionReq, {
      location: filenameInfo.location || void 0,
      salary: filenameInfo.salary || void 0,
      metaInfo: filenameInfo.metaInfo || void 0
    });
    if (!evalResult) return c.json({ detail: "AI\u8BC4\u4F30\u5931\u8D25" }, 500);
    await c.env.DB.prepare("UPDATE resumes SET ai_evaluation = ?, updated_at = ? WHERE candidate_name = ?").bind(JSON.stringify(evalResult), (/* @__PURE__ */ new Date()).toISOString(), candidateName).run();
    try {
      const tableId = getBitableTableId(c.env, "talent");
      const records = await bitableListRecords(c.env, tableId);
      const rec = records.find((r) => {
        const f = r.fields || {};
        return getFirstValue(f["\u59D3\u540D"]) === candidateName;
      });
      if (rec) {
        await bitableUpdateRecord(c.env, tableId, rec.record_id, {
          "AI\u7B80\u5386\u8BC4\u4F30": JSON.stringify(evalResult, null, 2)
        });
      }
    } catch {
    }
    return c.json({ ok: true, candidate_name: candidateName, dimensions: evalResult.dimensions || [], overall_score: evalResult.overall_score, summary: evalResult.summary });
  } catch (e) {
    return c.json({ detail: "\u81EA\u52A8\u8BC4\u4F30\u5931\u8D25: " + e.message }, 500);
  }
});
app.post("/api/resumes/auto-evaluate-all", authMiddleware, async (c) => {
  try {
    const user = c.get("user");
    const body = await c.req.json().catch(() => ({}));
    const force = body.force === true;
    const tableId = getBitableTableId(c.env, "talent");
    const records = await bitableListRecords(c.env, tableId);
    let myPositions = [];
    if (user.role !== "admin" && user.full_name) {
      const posRows = await c.env.DB.prepare(
        "SELECT DISTINCT title FROM positions WHERE (responsible_person = ? OR responsible_person LIKE ?)"
      ).bind(user.full_name, "%" + user.full_name + "%").all();
      for (const row of posRows.results || []) myPositions.push(row.title);
    }
    let evaluated = 0, skipped = 0, failed = 0;
    const errors = [], results = [];
    for (const rec of records) {
      const f = rec.fields || {};
      const candidateName = getFirstValue(f["\u59D3\u540D"]) || "Unknown";
      const position = getFirstValue(f["\u9762\u8BD5\u5C97\u4F4D"]) || getFirstValue(f["\u62DB\u8058\u5C97\u4F4D\u5339\u914D"]) || "";
      const filenameInfo = parseFilenameInfo(candidateName);
      const effectivePosition = position || filenameInfo.position || "";
      const existingEval = f["AI\u7B80\u5386\u8BC4\u4F30"];
      if (user.role !== "admin" && user.full_name && myPositions.length > 0 && !myPositions.includes(effectivePosition)) continue;
      if (!force && existingEval && String(existingEval).trim().length > 10) {
        skipped++;
        continue;
      }
      try {
        const resumeText = await getResumeText(c.env, candidateName);
        if (resumeText.length < 10) {
          results.push({ name: candidateName, status: "skip", reason: "\u65E0\u6CD5\u83B7\u53D6\u7B80\u5386\u539F\u6587" });
          skipped++;
          continue;
        }
        const positionReq = effectivePosition ? await getPositionRequirements(c.env, effectivePosition) : null;
        const evalResult = await callAIScreening(c.env, resumeText, positionReq, {
          location: filenameInfo.location || void 0,
          salary: filenameInfo.salary || void 0,
          metaInfo: filenameInfo.metaInfo || void 0
        });
        if (!evalResult) {
          results.push({ name: candidateName, status: "fail", reason: "AI\u8BC4\u4F30\u8FD4\u56DE\u7A7A" });
          failed++;
          continue;
        }
        try {
          await c.env.DB.prepare("UPDATE resumes SET ai_evaluation = ?, raw_text = ?, updated_at = ? WHERE candidate_name = ?").bind(JSON.stringify(evalResult), resumeText.substring(0, 5e4), (/* @__PURE__ */ new Date()).toISOString(), candidateName).run();
        } catch {
        }
        try {
          await bitableUpdateRecord(c.env, tableId, rec.record_id, { "AI\u7B80\u5386\u8BC4\u4F30": JSON.stringify(evalResult, null, 2), "\u7B80\u5386\u6587\u672C": resumeText.substring(0, 5e4) });
        } catch {
        }
        results.push({ name: candidateName, status: "ok", dims: (evalResult.dimensions || []).length, score: evalResult.overall_score });
        evaluated++;
      } catch (e) {
        failed++;
        errors.push(candidateName + ": " + e.message.substring(0, 100));
      }
    }
    return c.json({ ok: true, total: records.length, evaluated, skipped, failed, results, errors: errors.slice(0, 20) });
  } catch (e) {
    return c.json({ detail: "\u6279\u91CF\u81EA\u52A8\u8BC4\u4F30\u5931\u8D25: " + e.message }, 500);
  }
});
app.post("/api/resumes/fix-incomplete-evaluations", authMiddleware, requireRole(["admin"]), async (c) => {
  try {
    const tableId = getBitableTableId(c.env, "talent");
    const records = await bitableListRecords(c.env, tableId);
    let fixed = 0, skipped = 0, failed = 0;
    const errors = [], details = [];
    for (const rec of records) {
      const f = rec.fields || {};
      const candidateName = getFirstValue(f["\u59D3\u540D"]) || "";
      const position = getFirstValue(f["\u9762\u8BD5\u5C97\u4F4D"]) || getFirstValue(f["\u62DB\u8058\u5C97\u4F4D\u5339\u914D"]) || "";
      const existingEval = f["AI\u7B80\u5386\u8BC4\u4F30"];
      if (!candidateName) {
        skipped++;
        continue;
      }
      const evalStr = String(existingEval || "").trim();
      const needFix = !evalStr || evalStr.length < 15 || evalStr === "None" || evalStr === "{}" || evalStr.includes("\u63A8\u8350\u610F\u89C1: -") || evalStr.includes("\u5339\u914D\u5206\u6570: -/100") && evalStr.includes("\u63A8\u8350\u610F\u89C1: -");
      if (!needFix) {
        skipped++;
        continue;
      }
      try {
        const resumeText = await getResumeText(c.env, candidateName);
        if (resumeText.length < 10) {
          details.push({ name: candidateName, status: "no_text", reason: "\u65E0\u6CD5\u83B7\u53D6\u7B80\u5386\u539F\u6587" });
          skipped++;
          continue;
        }
        const customPrompt = await getCustomPrompt(c.env, "analyze_resume");
        let systemPrompt, userPrompt;
        if (customPrompt) {
          let sp = customPrompt.system, up = customPrompt.user;
          if (sp.includes("{candidate_name}")) sp = sp.replace(/\{candidate_name\}/g, candidateName);
          if (up.includes("{candidate_name}")) up = up.replace(/\{candidate_name\}/g, candidateName);
          if (up.includes("{resume_text}")) up = up.replace(/\{resume_text\}/g, resumeText);
          if (sp.includes("{resume_text}")) sp = sp.replace(/\{resume_text\}/g, resumeText);
          systemPrompt = sp;
          userPrompt = up;
        } else {
          systemPrompt = `\u4F60\u662F\u4E00\u4F4D\u8D44\u6DF1\u62DB\u8058\u4E13\u5BB6\u548C\u7B80\u5386\u89E3\u6790\u52A9\u624B\u3002\u8BF7\u89E3\u6790\u4EE5\u4E0B\u7B80\u5386\u6587\u672C\uFF0C\u63D0\u53D6\u5B8C\u6574\u4FE1\u606F\u5E76\u8FDB\u884CAI\u521D\u7B5B\u8BC4\u4F30\u3002\u8FD4\u56DEJSON\u683C\u5F0F\uFF08\u4E0D\u8981\u52A0markdown\u4EE3\u7801\u5757\uFF09\uFF0C\u5305\u542B\u4E24\u90E8\u5206\uFF1A

\u7B2C\u4E00\u90E8\u5206 - \u57FA\u7840\u4FE1\u606F\uFF1A
- candidate_name: \u5019\u9009\u4EBA\u59D3\u540D
- gender: \u6027\u522B
- age: \u5E74\u9F84
- phone: \u624B\u673A\u53F7\u7801
- email: \u7535\u5B50\u90AE\u7BB1
- highest_degree: \u6700\u9AD8\u5B66\u5386
- school: \u6BD5\u4E1A\u9662\u6821
- major: \u4E13\u4E1A
- graduation_year: \u6BD5\u4E1A\u5E74\u4EFD
- years_of_experience: \u5DE5\u4F5C\u5E74\u9650
- current_company: \u76EE\u524D/\u6700\u8FD1\u6240\u5728\u516C\u53F8
- current_position: \u76EE\u524D/\u6700\u8FD1\u804C\u4F4D
- salary_expectation: \u671F\u671B\u85AA\u8D44
- skills: \u6280\u80FD\u5217\u8868\uFF08\u6570\u7EC4\uFF09
- certifications: \u8BC1\u4E66/\u8D44\u8D28\uFF08\u6570\u7EC4\uFF09
- work_experience: \u5DE5\u4F5C\u7ECF\u5386\u6570\u7EC4
- education: \u6559\u80B2\u7ECF\u5386\u6570\u7EC4

\u7B2C\u4E8C\u90E8\u5206 - AI\u521D\u7B5B\u8BC4\u4F30\uFF1A
- position: \u5E94\u8058\u5C97\u4F4D
- advantage: \u4F18\u52BF\u5206\u6790\uFF08\u4E2D\u6587\uFF0C3-5\u4E2A\u6838\u5FC3\u4F18\u52BF\uFF09
- risk: \u98CE\u9669\u70B9\uFF08\u4E2D\u6587\uFF0C2-4\u4E2A\u52A3\u52BF\u6216\u98CE\u9669\uFF09
- match_score: \u4EBA\u5C97\u5339\u914D\u5EA6\uFF080-100\u6574\u6570\uFF09
- recommendation: \u63A8\u8350\u5EFA\u8BAE
- summary: \u7EFC\u5408\u5206\u6790\u6458\u8981\uFF08\u4E2D\u6587\uFF0C2-3\u53E5\u8BDD\uFF09
- suggested_questions: \u5EFA\u8BAE\u9762\u8BD5\u95EE\u9898\uFF08\u4E2D\u6587\uFF0C3-5\u4E2A\uFF09`;
          userPrompt = "\u7B80\u5386\u6587\u672C\uFF1A\n" + resumeText;
        }
        const result = await callAI(c.env, systemPrompt, userPrompt);
        let parsed;
        try {
          parsed = extractJSON(result);
        } catch {
          parsed = { raw_response: result };
        }
        const flattened = {};
        for (const [k, v] of Object.entries(parsed)) {
          if (typeof v === "object" && v !== null && !Array.isArray(v)) Object.assign(flattened, v);
          else flattened[k] = v;
        }
        const merged = { ...parsed, ...flattened };
        const advantage = merged.advantage || merged.advantages || "";
        const risk = merged.risk || merged.risks || "";
        const matchScore = typeof merged.match_score === "number" ? merged.match_score : null;
        const recommendation = merged.recommendation || "";
        const recLabel = {
          "strongly_recommend": "\u5F3A\u70C8\u63A8\u8350",
          "recommend": "\u63A8\u8350",
          "neutral": "\u5F85\u5B9A",
          "not_recommend": "\u4E0D\u63A8\u8350",
          "strongly_not_recommend": "\u5F3A\u70C8\u4E0D\u63A8\u8350"
        };
        const evalSummary = [
          merged.summary || "",
          "",
          `\u5339\u914D\u5206\u6570: ${matchScore !== null ? matchScore + "/100" : "-"}`,
          `\u63A8\u8350\u610F\u89C1: ${recLabel[recommendation] || recommendation || "-"}`,
          "",
          advantage ? `\u4F18\u52BF:
${advantage}` : "",
          risk ? `
\u98CE\u9669:
${risk}` : ""
        ].filter(Boolean).join("\n");
        try {
          await bitableUpdateRecord(c.env, tableId, rec.record_id, {
            "AI\u7B80\u5386\u8BC4\u4F30": evalSummary,
            "\u4F18\u52BF\u5206\u6790": advantage,
            "\u98CE\u9669\u70B9": risk,
            "AI\u7B80\u5386\u521D\u7B5B\u7ED3\u679C": recommendation || ""
          });
        } catch (e) {
          console.error(`[FixEval] \u98DE\u4E66\u66F4\u65B0\u5931\u8D25 ${candidateName}: ${e.message}`);
        }
        try {
          const d1Row = await c.env.DB.prepare("SELECT id FROM resumes WHERE candidate_name = ? LIMIT 1").bind(candidateName).first();
          if (d1Row) {
            await c.env.DB.prepare(
              "UPDATE resumes SET parsed_data = ?, ai_review = ?, match_score = ?, screening_result = ?, raw_text = ?, updated_at = ? WHERE id = ?"
            ).bind(
              JSON.stringify(merged),
              evalSummary,
              matchScore,
              merged.recommendation || JSON.stringify(merged),
              resumeText.substring(0, 5e4),
              (/* @__PURE__ */ new Date()).toISOString(),
              d1Row.id
            ).run();
          }
        } catch {
        }
        details.push({ name: candidateName, status: "fixed", score: matchScore, recommendation });
        fixed++;
      } catch (e) {
        failed++;
        errors.push(`${candidateName}: ${e.message?.substring(0, 100)}`);
      }
    }
    return c.json({
      ok: true,
      total: records.length,
      fixed,
      skipped,
      failed,
      details: details.slice(0, 100),
      errors: errors.slice(0, 20)
    });
  } catch (e) {
    return c.json({ detail: "\u4FEE\u590D\u5931\u8D25: " + e.message }, 500);
  }
});
app.post("/api/position-mappings/fix-responsible", authMiddleware, requireRole(["admin"]), async (c) => {
  try {
    const rows = await c.env.DB.prepare("SELECT id, mapped_name, responsible_person FROM position_mappings").all();
    let fixed = 0;
    for (const row of rows.results || []) {
      const r = row;
      let person = r.responsible_person;
      if (person && typeof person === "object") {
        try {
          const parsed = typeof person === "string" ? JSON.parse(person) : person;
          if (parsed.name) person = parsed.name;
          else if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].name) person = parsed[0].name;
          else person = String(parsed);
        } catch {
          person = String(person);
        }
        await c.env.DB.prepare("UPDATE position_mappings SET responsible_person = ? WHERE id = ?").bind(person, r.id).run();
        fixed++;
      }
    }
    return c.json({ ok: true, fixed });
  } catch (e) {
    return c.json({ detail: e.message }, 500);
  }
});
app.notFound((c) => {
  if (c.req.path.startsWith("/api/")) {
    return c.json({ detail: "Not found" }, 404);
  }
  if (c.env.ASSETS) {
    return c.env.ASSETS.fetch(c.req.raw);
  }
  return c.text("Not found", 404);
});
app.post("/api/resumes/fix-missing-fields", authMiddleware, requireRole(["admin"]), async (c) => {
  try {
    try {
      await c.env.DB.prepare(
        "CREATE TABLE IF NOT EXISTS resume_extras (feishu_record_id TEXT PRIMARY KEY, major TEXT DEFAULT '', gender TEXT DEFAULT '', education TEXT DEFAULT '', age TEXT DEFAULT '', updated_at TEXT DEFAULT '')"
      ).run();
    } catch {
    }
    const tableId = getBitableTableId(c.env, "talent");
    const records = await bitableListRecords(c.env, tableId);
    let updated = 0, skipped = 0, failed = 0;
    const details = [];
    const BATCH_SIZE = 10;
    let processedInBatch = 0;
    for (let batchStart = 0; batchStart < records.length && processedInBatch < BATCH_SIZE; batchStart += 1) {
      const rec = records[batchStart];
      try {
        const f = rec.fields || {};
        const candidateName = getFirstValue(f["\u59D3\u540D"]) || "";
        const recordId = rec.record_id;
        if (!candidateName || !recordId) {
          skipped++;
          continue;
        }
        const existing = await c.env.DB.prepare("SELECT major FROM resume_extras WHERE feishu_record_id = ?").bind(recordId).first();
        if (existing && existing.major) {
          skipped++;
          continue;
        }
        const existingMajor = getFirstValue(f["\u4E13\u4E1A"]) || "";
        const existingEdu = getFirstValue(f["\u5B66\u5386"]) || "";
        const existingGender = getFirstValue(f["\u6027\u522B"]) || "";
        const existingAge = f["\u5E74\u9F84"] || "";
        const existingEval = getFirstValue(f["AI\u7B80\u5386\u8BC4\u4F30"]) || "";
        if (existingMajor) {
          skipped++;
          continue;
        }
        const evalText = String(existingEval || "");
        if (evalText.length < 50) {
          skipped++;
          details.push(`${candidateName}: \u8BC4\u4F30\u6587\u672C\u4E0D\u8DB3`);
          continue;
        }
        const aiResult = await callAI(
          c.env,
          '\u4ECE\u4EE5\u4E0B\u7B80\u5386\u8BC4\u4F30\u6587\u672C\u4E2D\u63D0\u53D6\u57FA\u672C\u4FE1\u606F\uFF0C\u53EA\u8FD4\u56DEJSON\uFF1A{"major":"\u4E13\u4E1A\u540D\u79F0","gender":"\u7537/\u5973","education":"\u5B66\u5386","age":\u5E74\u9F84\u6570\u5B57}\u3002\u5B57\u6BB5\u627E\u4E0D\u5230\u5C31\u586B"\u65E0"\u3002',
          "\u8BC4\u4F30\u6587\u672C\uFF1A\n" + evalText.substring(0, 5e3),
          "deepseek-chat"
        );
        if (!aiResult) {
          skipped++;
          continue;
        }
        let parsed;
        const m = aiResult.match(/\{[\s\S]*\}/);
        if (m) try {
          parsed = JSON.parse(m[0]);
        } catch {
        }
        let major = parsed?.major && parsed.major !== "\u65E0" ? parsed.major : "";
        const gender = parsed?.gender && parsed.gender !== "\u65E0" ? parsed.gender : "";
        const education = parsed?.education && parsed.education !== "\u65E0" ? parsed.education : "";
        const age = parsed?.age ? String(parsed.age) : "";
        if (!major) {
          try {
            const resumeText = await getResumeText(c.env, candidateName);
            if (resumeText && resumeText.length > 100) {
              const pdfExtract = await callAI(
                c.env,
                '\u4ECE\u4EE5\u4E0B\u7B80\u5386\u539F\u6587\u4E2D\u63D0\u53D6"\u4E13\u4E1A"\u5B57\u6BB5\u3002\u53EA\u8FD4\u56DEJSON\uFF1A{"major":"\u4E13\u4E1A\u540D\u79F0"}\u3002\u627E\u4E0D\u5230\u5C31\u586B"\u65E0"\u3002',
                "\u7B80\u5386\u539F\u6587\uFF1A\n" + resumeText.substring(0, 4e3),
                "deepseek-chat"
              );
              if (pdfExtract) {
                const pm = pdfExtract.match(/\{[\s\S]*\}/);
                if (pm) try {
                  const pp = JSON.parse(pm[0]);
                  if (pp.major && pp.major !== "\u65E0") major = pp.major;
                } catch {
                }
              }
            }
          } catch {
          }
        }
        if (!major) major = "\u65E0";
        await c.env.DB.prepare(
          "INSERT OR REPLACE INTO resume_extras (feishu_record_id, major, gender, education, age, updated_at) VALUES (?, ?, ?, ?, ?, datetime('now'))"
        ).bind(recordId, major, gender || existingGender, education || existingEdu, age || String(existingAge)).run();
        processedInBatch++;
        updated++;
        details.push(`${candidateName}: major=${major}`);
      } catch (e) {
        failed++;
        details.push(`${getFirstValue(rec.fields?.["\u59D3\u540D"]) || "?"}: ${e.message.substring(0, 80)}`);
      }
    }
    return c.json({ ok: true, total: records.length, updated, skipped, failed, details });
  } catch (e) {
    return c.json({ detail: "\u5904\u7406\u5931\u8D25: " + e.message }, 500);
  }
});
app.post("/api/auth/migrate-plain-passwords", authMiddleware, requireRole(["admin"]), async (c) => {
  try {
    await c.env.DB.prepare("ALTER TABLE users ADD COLUMN plain_password TEXT DEFAULT ''").run();
  } catch {
  }
  const rows = await c.env.DB.prepare("SELECT id, hashed_password FROM users WHERE plain_password IS NULL OR plain_password = ''").all();
  let fixed = 0;
  for (const row of rows.results) {
    await c.env.DB.prepare("UPDATE users SET plain_password = '123456' WHERE id = ?").bind(row.id).run();
    fixed++;
  }
  return c.json({ ok: true, fixed, total: rows.results.length });
});
app.delete("/api/resumes/cleanup-pdfs", authMiddleware, async (c) => {
  try {
    const days = parseInt(c.req.query("days") || "30");
    const db = c.env.DB;
    const countResult = await db.prepare(
      `SELECT COUNT(*) as cnt FROM resume_files WHERE created_at < datetime('now', ?)`
    ).bind(`-${days} days`).first();
    const cnt = countResult?.cnt || 0;
    if (cnt > 0) {
      await db.prepare(
        `DELETE FROM resume_files WHERE created_at < datetime('now', ?)`
      ).bind(`-${days} days`).run();
    }
    return c.json({ ok: true, deleted: cnt, days });
  } catch (e) {
    return c.json({ detail: "\u6E05\u7406\u5931\u8D25: " + e.message }, 500);
  }
});
app.notFound(async (c) => {
  if (c.req.path.startsWith("/api/")) {
    return c.json({ detail: "Not found" }, 404);
  }
  if (c.env.ASSETS) {
    return c.env.ASSETS.fetch(c.req.raw);
  }
  return c.text("Not found", 404);
});
async function scheduledRefreshFeishuTokens(env) {
  const nowUnix = Math.floor(Date.now() / 1e3);
  const refreshThreshold = nowUnix + 90 * 60;
  let refreshed = 0;
  let failed = 0;
  try {
    const rows = await env.DB.prepare(`
      SELECT user_email FROM feishu_tokens
      WHERE refresh_token IS NOT NULL AND refresh_token != ''
        AND expires_at < ?
      ORDER BY expires_at ASC
      LIMIT 50
    `).bind(refreshThreshold).all();
    const candidates = rows.results || [];
    for (const row of candidates) {
      try {
        const result = await refreshUserFeishuToken(env, row.user_email);
        if (result) {
          refreshed++;
        } else {
          failed++;
        }
      } catch (e) {
        console.error(`[scheduledRefreshFeishuTokens] \u5237\u65B0 ${row.user_email} \u5F02\u5E38: ${e.message}`);
        failed++;
      }
    }
    console.log(`[scheduledRefreshFeishuTokens] \u5B8C\u6210: \u6210\u529F=${refreshed}, \u5931\u8D25=${failed}`);
  } catch (e) {
    console.error(`[scheduledRefreshFeishuTokens] \u67E5\u8BE2\u5F02\u5E38: ${e.message}`);
  }
}
app.get("/api/debug/annual-fields", authMiddleware, async (c) => {
  try {
    const srcTableId = c.env.FEISHU_POSITION_TABLE_ID || FEISHU_CONFIG.positionTableId;
    const token = await getFeishuToken(c.env);
    const appToken = c.env.FEISHU_BITABLE_APP_TOKEN || FEISHU_CONFIG.appToken;
    const resp = await fetch(
      `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${srcTableId}/records?page_size=2`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await resp.json();
    if (!data.data) return c.json({ error: data });
    const items = data.data.items || [];
    const result = items.map((r) => ({
      id: r.record_id,
      fields: Object.keys(r.fields || {})
    }));
    const allFields = [...new Set(items.flatMap((r) => Object.keys(r.fields || {})))].sort();
    return c.json({ allFieldNames: allFields, records: result });
  } catch (e) {
    return c.json({ error: e.message }, 500);
  }
});
app.get("/api/debug/requisition-fields", authMiddleware, async (c) => {
  try {
    const dstTableId = getBitableTableId(c.env, "requisition");
    const token = await getFeishuToken(c.env);
    const appToken = c.env.FEISHU_BITABLE_APP_TOKEN || FEISHU_CONFIG.appToken;
    const resp = await fetch(
      `https://open.feishu.cn/open-apis/bitable/v1/apps/${appToken}/tables/${dstTableId}/records?page_size=2`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await resp.json();
    if (!data.data) return c.json({ error: data });
    const items = data.data.items || [];
    const allFields = [...new Set(items.flatMap((r) => Object.keys(r.fields || {})))].sort();
    return c.json({ allFieldNames: allFields });
  } catch (e) {
    return c.json({ error: e.message }, 500);
  }
});
app.post("/api/feishu/sync-contacts", authMiddleware, async (c) => {
  try {
    const token = await getFeishuToken(c.env);
    let pageToken;
    let total = 0;
    const allDeptIds = ["0"];
    let deptPageToken;
    do {
      let deptUrl = "https://open.feishu.cn/open-apis/contact/v3/departments?page_size=50";
      if (deptPageToken) deptUrl += `&page_token=${deptPageToken}`;
      const deptResp = await fetch(deptUrl, { headers: { Authorization: `Bearer ${token}` } });
      const deptData = await deptResp.json();
      if (deptData.code !== 0) break;
      for (const d of deptData.data?.items || []) {
        allDeptIds.push(d.open_department_id);
      }
      deptPageToken = deptData.data?.page_token;
    } while (deptPageToken);
    for (const deptId of allDeptIds) {
      pageToken = void 0;
      do {
        let url = `https://open.feishu.cn/open-apis/contact/v3/users/find_by_department?department_id=${deptId}&page_size=50`;
        if (pageToken) url += `&page_token=${pageToken}`;
        const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        const data = await resp.json();
        if (data.code !== 0) break;
        for (const u of data.data?.items || []) {
          const name = u.name || u.nickname || "";
          const openId = u.open_id || "";
          if (!name || !openId) continue;
          const department = (u.department_ids || []).join(",");
          const email = u.email || "";
          const mobile = u.mobile || "";
          const avatarUrl = u.avatar?.avatar_72 || "";
          await c.env.DB.prepare(
            `INSERT INTO feishu_contacts (name, open_id, department, email, mobile, avatar_url, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(open_id) DO UPDATE SET
               name = excluded.name, department = excluded.department,
               email = excluded.email, mobile = excluded.mobile,
               avatar_url = excluded.avatar_url, updated_at = excluded.updated_at`
          ).bind(name, openId, department, email, mobile, avatarUrl, now()).run();
          total++;
        }
        pageToken = data.data?.page_token;
      } while (pageToken);
    }
    return c.json({ ok: true, message: `\u901A\u8BAF\u5F55\u540C\u6B65\u5B8C\u6210\uFF0C\u5171 ${total} \u4EBA\uFF08${allDeptIds.length} \u4E2A\u90E8\u95E8\uFF09` });
  } catch (e) {
    return c.json({ detail: "\u901A\u8BAF\u5F55\u540C\u6B65\u5931\u8D25: " + e.message }, 500);
  }
});
app.get("/api/feishu/search-contact", authMiddleware, async (c) => {
  try {
    const name = c.req.query("name") || "";
    if (!name) return c.json([]);
    const { results } = await c.env.DB.prepare(
      `SELECT name, open_id, department, email FROM feishu_contacts WHERE name LIKE ? LIMIT 20`
    ).bind(`%${name}%`).all();
    return c.json(results || []);
  } catch (e) {
    return c.json({ detail: e.message }, 500);
  }
});
async function getContactOpenId(env, name) {
  try {
    const row = await env.DB.prepare(
      "SELECT open_id FROM feishu_contacts WHERE name = ? LIMIT 1"
    ).bind(name).first();
    if (row?.open_id) return row.open_id;
    const { results } = await env.DB.prepare(
      "SELECT name, open_id FROM feishu_contacts WHERE name LIKE ? LIMIT 5"
    ).bind(`%${name}%`).all();
    if (results?.length > 0) return results[0].open_id;
    return "";
  } catch {
    return "";
  }
}
var index_default = {
  async fetch(request, env, ctx) {
    const colMigrations = [
      "CREATE TABLE IF NOT EXISTS feishu_contacts (open_id TEXT PRIMARY KEY, name TEXT NOT NULL, department TEXT DEFAULT '', email TEXT DEFAULT '', mobile TEXT DEFAULT '', avatar_url TEXT DEFAULT '', updated_at TEXT DEFAULT '')",
      "ALTER TABLE positions ADD COLUMN primary_interviewer TEXT DEFAULT ''",
      "ALTER TABLE positions ADD COLUMN secondary_interviewer TEXT DEFAULT ''",
      "ALTER TABLE interviews ADD COLUMN primary_interviewer TEXT DEFAULT ''",
      "ALTER TABLE interviews ADD COLUMN secondary_interviewer TEXT DEFAULT ''",
      "ALTER TABLE positions ADD COLUMN responsible_person TEXT DEFAULT ''",
      "ALTER TABLE positions ADD COLUMN personalized_requirements TEXT DEFAULT ''",
      "ALTER TABLE positions ADD COLUMN capability_dimensions TEXT DEFAULT '[]'",
      "ALTER TABLE users ADD COLUMN feishu_token TEXT DEFAULT ''",
      "ALTER TABLE job_requisitions ADD COLUMN personalized_requirements TEXT DEFAULT ''",
      "ALTER TABLE job_requisitions ADD COLUMN capability_dimensions TEXT DEFAULT ''"
    ];
    for (const sql of colMigrations) {
      try {
        await env.DB.prepare(sql).run();
      } catch {
      }
    }
    return app.fetch(request, env, ctx);
  },
  async scheduled(event, env, ctx) {
    const cron = event?.cron || "";
    if (cron === "*/30 * * * *") {
      await scheduledRefreshFeishuTokens(env);
    } else {
      const days = 7;
      const deleted = await env.DB.prepare(
        `DELETE FROM resume_files WHERE created_at < datetime('now', ?)`
      ).bind(`-${days} days`).run();
      console.log(`[cron:cleanup-pdfs] deleted ${deleted.meta?.changes || 0} stale resume_files`);
    }
  }
};
export {
  index_default as default
};
