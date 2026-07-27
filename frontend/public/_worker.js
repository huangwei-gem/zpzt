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
  return rest;
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
app.put("/api/auth/me", authMiddleware, async (c) => {
  const user = c.get("user");
  const body = await c.req.json();
  const updates = {};
  for (const k of ["full_name"]) {
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
app.get("/api/auth/users", authMiddleware, requireRole(["admin"]), async (c) => {
  const result = await c.env.DB.prepare("SELECT * FROM users ORDER BY created_at DESC").all();
  return c.json(result.results.map(serializeUser));
});
app.post("/api/auth/users", authMiddleware, requireRole(["admin"]), async (c) => {
  const body = await c.req.json();
  const id = uuid();
  const hash = await hashPassword(c.env.SECRET_KEY, body.password || "demo123");
  await c.env.DB.prepare(
    "INSERT INTO users (id, email, hashed_password, full_name, role, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, ?, ?)"
  ).bind(id, body.email, hash, body.full_name || "", (body.role || "hr").toLowerCase(), now(), now()).run();
  const user = await getUser(c.env.DB, body.email);
  return c.json(serializeUser(user));
});
app.put("/api/auth/users/:id", authMiddleware, requireRole(["admin"]), async (c) => {
  const id = c.req.param("id");
  const body = await c.req.json();
  const updates = {};
  for (const k of ["full_name", "email", "role"]) {
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
app.delete("/api/auth/users/:id", authMiddleware, requireRole(["admin"]), async (c) => {
  const id = c.req.param("id");
  await c.env.DB.prepare("DELETE FROM users WHERE id = ?").bind(id).run();
  return c.json({ detail: "User deleted" });
});
app.get("/api/auth/interviewers", authMiddleware, async (c) => {
  const result = await c.env.DB.prepare("SELECT * FROM users WHERE lower(role) = 'interviewer' AND is_active = 1").all();
  return c.json(result.results.map(serializeUser));
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
app.get("/api/dashboard/positions", authMiddleware, async (c) => {
  const db = c.env.DB;
  const positions = await db.prepare("SELECT * FROM positions ORDER BY created_at DESC LIMIT 10").all();
  const result = [];
  for (const pos of positions.results) {
    const r = await db.prepare("SELECT COUNT(*) as cnt FROM resumes WHERE position_id = ?").bind(pos.id).first();
    const ps = await db.prepare("SELECT COUNT(*) as cnt FROM resumes WHERE position_id = ? AND stage = 'new'").bind(pos.id).first();
    const pi = await db.prepare("SELECT COUNT(*) as cnt FROM resumes WHERE position_id = ? AND stage = 'interview'").bind(pos.id).first();
    result.push({
      id: pos.id,
      title: pos.title,
      department: pos.department,
      status: pos.status,
      total_resumes: r?.cnt || 0,
      pending_screening: ps?.cnt || 0,
      pending_interview: pi?.cnt || 0
    });
  }
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
  const totalPos = await db.prepare("SELECT COUNT(*) as cnt FROM positions").first();
  const activePos = await db.prepare("SELECT COUNT(*) as cnt FROM positions WHERE status IN ('open','published')").first();
  const totalResumes = await db.prepare("SELECT COUNT(*) as cnt FROM resumes").first();
  const pendingResumes = await db.prepare("SELECT COUNT(*) as cnt FROM resumes WHERE status LIKE 'pending%'").first();
  const totalInterviews = await db.prepare("SELECT COUNT(*) as cnt FROM interviews").first();
  const completedInterviews = await db.prepare("SELECT COUNT(*) as cnt FROM interviews WHERE status = 'completed'").first();
  return c.json({
    total_positions: totalPos?.cnt || 0,
    active_positions: activePos?.cnt || 0,
    total_resumes: totalResumes?.cnt || 0,
    pending_resumes: pendingResumes?.cnt || 0,
    total_interviews: totalInterviews?.cnt || 0,
    completed_interviews: completedInterviews?.cnt || 0
  });
});
app.get("/api/dashboard/hr-stats", authMiddleware, async (c) => {
  const db = c.env.DB;
  const totalReq = await db.prepare("SELECT COUNT(*) as cnt FROM job_requisitions").first();
  const pendingReq = await db.prepare("SELECT COUNT(*) as cnt FROM job_requisitions WHERE status = 'pending'").first();
  const approvedReq = await db.prepare("SELECT COUNT(*) as cnt FROM job_requisitions WHERE status = 'approved'").first();
  const tpSize = await db.prepare("SELECT COUNT(*) as cnt FROM talent_pool").first();
  const obCnt = await db.prepare("SELECT COUNT(*) as cnt FROM onboarding_records").first();
  const pbCnt = await db.prepare("SELECT COUNT(*) as cnt FROM probation_records").first();
  return c.json({
    total_requisitions: totalReq?.cnt || 0,
    pending_requisitions: pendingReq?.cnt || 0,
    approved_requisitions: approvedReq?.cnt || 0,
    talent_pool_size: tpSize?.cnt || 0,
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
var FEISHU_TALENT_FIELDS = {
  candidate_name: "\u59D3\u540D",
  position_applied: "\u9762\u8BD5\u5C97\u4F4D",
  mapped_position: "\u62DB\u8058\u5C97\u4F4D\u5339\u914D",
  gender: "\u6027\u522B",
  city: "\u57CE\u5E02",
  age: "\u5E74\u9F84",
  education: "\u5B66\u5386",
  ai_evaluation: "AI\u7B80\u5386\u8BC4\u4F30",
  screening_result: "AI\u7B80\u5386\u521D\u7B5B\u7ED3\u679C",
  advantage: "\u4F18\u52BF\u5206\u6790",
  risk: "\u98CE\u9669\u70B9",
  hr_review: "HR\u590D\u6838\u7ED3\u679C",
  interview_suggestion: "\u4E00\u9762\u5EFA\u8BAE",
  interview_questions: "\u9762\u8BD5\u95EE\u9898\u5EFA\u8BAE",
  notes: "\u5907\u6CE8-\u624B\u52A8",
  reserve_type: "\u50A8\u5907\u4EBA\u624D\u7C7B\u578B-\u624B\u52A8",
  job_description: "\u5C97\u4F4DJD",
  capability_dimensions: "\u5C97\u4F4D\u80FD\u529B\u7EF4\u5EA6\u8981\u6C42",
  source_id: "SourceID",
  biz_owner: "\u4E1A\u52A1\u8D1F\u8D23\u4EBA",
  biz_review: "\u4E1A\u52A1\u590D\u6838\u7ED3\u679C",
  biz_reviewer_2: "\u4E8C\u9762\u8D1F\u8D23\u4EBA",
  biz_reviewer_3: "\u4E09\u9762\u8D1F\u8D23\u4EBA",
  hr_pass_date: "HR\u521D\u7B5B\u901A\u8FC7\u65E5\u671F",
  attachment: "\u7B80\u5386\u9644\u4EF6-\u6279\u91CF\u5BFC\u5165",
  create_time: "\u521B\u5EFA\u65F6\u95F4"
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
  if (Array.isArray(v)) return v.length > 0 ? String(v[0]) : null;
  if (typeof v === "object" && v.name) return v.name;
  if (typeof v === "object" && v.text) return v.text;
  return String(v);
}
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
    candidate_name: getFirstValue(f["\u59D3\u540D"]) || "",
    position_applied: getFirstValue(f["\u9762\u8BD5\u5C97\u4F4D"]) || getFirstValue(f["\u62DB\u8058\u5C97\u4F4D"]) || "",
    mapped_position: getFirstValue(f["\u62DB\u8058\u5C97\u4F4D\u5339\u914D"]) || "",
    gender: getFirstValue(f["\u6027\u522B"]) || "",
    city: getFirstValue(f["\u57CE\u5E02"]) || "",
    age: f["\u5E74\u9F84"] || null,
    education: getFirstValue(f["\u5B66\u5386"]) || "",
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
    _raw_fields: f
  };
}
function parseRequisitionRecord(record) {
  const f = record.fields || {};
  const headcount = f["\u62DB\u8058\u4EBA\u6570"] || 1;
  const urgency = mapUrgency(f["\u7D27\u6025\u5EA6"]);
  const status = mapStatus(f["\u62DB\u8058\u72B6\u6001"]);
  return {
    id: record.record_id,
    title: getFirstValue(f["\u62DB\u8058\u5C97\u4F4D"]) || "(\u672A\u547D\u540D\u5C97\u4F4D)",
    department: getFirstValue(f["\u4E8C\u7EA7\u90E8\u95E8"]) || "",
    department_3rd: getFirstValue(f["\u4E09\u7EA7\u90E8\u95E8"]) || "",
    city: getFirstValue(f["\u62DB\u8058\u57CE\u5E02"]) || "",
    headcount: typeof headcount === "number" ? headcount : parseInt(String(headcount)) || 1,
    urgency,
    status,
    reason: getFirstValue(f["\u62DB\u8058\u7406\u7531"]) || "",
    notes: getFirstValue(f["\u8BF4\u660E"]) || "",
    description: getFirstValue(f["\u62DB\u8058JD"]) || "",
    requirements: getFirstValue(f["\u5C97\u4F4D\u804C\u8D23\u4E0E\u4EFB\u804C\u8981\u6C42"]) || "",
    capability_requirements: getFirstValue(f["\u5C97\u4F4D\u80FD\u529B\u63D0\u53D6"]) || "",
    capability_dimensions: getFirstValue(f["\u5C97\u4F4D\u80FD\u529B\u7EF4\u5EA6\u8981\u6C42"]) || "",
    city_tier: getFirstValue(f["\u57CE\u5E02\u7B49\u7EA7"]) || "",
    in_budget: getFirstValue(f["\u662F\u5426\u5728\u7F16\u5236\u5185"]) || "",
    responsible_person: getFirstValue(f["\u8D23\u4EFB\u4EBA"]) || getFirstValue(f["\u62DB\u8058\u8D26\u53F7"]) || "",
    recruitment_account: getFirstValue(f["\u62DB\u8058\u8D26\u53F7"]) || "",
    hr_interviewer: getUserName(f["HR\u4E8C\u9762"]),
    biz_interviewer: getUserName(f["\u4E1A\u52A1\u4E00\u9762"]),
    final_interviewer: getUserName(f["\u7EC8\u9762"]),
    start_date: f["\u5F00\u59CB\u62DB\u8058"] || null,
    end_date: f["\u7ED3\u675F\u62DB\u8058"] || null,
    employment_type: "full_time",
    salary_range: "",
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
  if (typeof v === "string") return v;
  if (typeof v === "object" && v) return v.text || v.name || String(v);
  return "\u666E\u901A";
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
  const status = c.req.query("status");
  if (status) {
    conditions.push("i.status = ?");
    binds.push(status);
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
app.get("/api/talent-pool", authMiddleware, async (c) => {
  try {
    const tableId = getBitableTableId(c.env, "talent");
    const records = await bitableListRecords(c.env, tableId);
    const items = records.map(parseTalentRecord);
    const statusFilter = c.req.query("status");
    const nameFilter = c.req.query("candidate_name");
    let filtered = items;
    if (statusFilter) filtered = filtered.filter((i) => i.status === statusFilter);
    if (nameFilter) filtered = filtered.filter((i) => i.candidate_name?.includes(nameFilter));
    return c.json(filtered);
  } catch (e) {
    console.error(`[Bitable] \u4EBA\u624D\u5E93\u5217\u8868\u5931\u8D25: ${e.message}`);
    return c.json({ detail: "\u8BFB\u53D6\u98DE\u4E66\u6570\u636E\u5931\u8D25: " + e.message }, 500);
  }
});
app.get("/api/talent-pool/:id", authMiddleware, async (c) => {
  try {
    const tableId = getBitableTableId(c.env, "talent");
    const record = await bitableGetRecord(c.env, tableId, c.req.param("id"));
    if (!record) return c.json({ detail: "Not found" }, 404);
    return c.json(parseTalentRecord(record));
  } catch (e) {
    return c.json({ detail: e.message }, 500);
  }
});
app.post("/api/talent-pool", authMiddleware, async (c) => {
  try {
    const body = await c.req.json();
    const tableId = getBitableTableId(c.env, "talent");
    const fields = feishuFieldsToRecord(FEISHU_TALENT_FIELDS, body);
    const recordId = await bitableCreateRecord(c.env, tableId, fields);
    if (!recordId) return c.json({ detail: "Create failed" }, 500);
    const record = await bitableGetRecord(c.env, tableId, recordId);
    return c.json(parseTalentRecord(record));
  } catch (e) {
    return c.json({ detail: "\u521B\u5EFA\u5931\u8D25: " + e.message }, 500);
  }
});
app.put("/api/talent-pool/:id", authMiddleware, async (c) => {
  try {
    const body = await c.req.json();
    const tableId = getBitableTableId(c.env, "talent");
    const fields = feishuFieldsToRecord(FEISHU_TALENT_FIELDS, body);
    await bitableUpdateRecord(c.env, tableId, c.req.param("id"), fields);
    const record = await bitableGetRecord(c.env, tableId, c.req.param("id"));
    return c.json(parseTalentRecord(record));
  } catch (e) {
    return c.json({ detail: "\u66F4\u65B0\u5931\u8D25: " + e.message }, 500);
  }
});
app.delete("/api/talent-pool/:id", authMiddleware, async (c) => {
  try {
    const tableId = getBitableTableId(c.env, "talent");
    await bitableDeleteRecord(c.env, tableId, c.req.param("id"));
    return c.json({ detail: "Deleted" });
  } catch (e) {
    return c.json({ detail: "\u5220\u9664\u5931\u8D25: " + e.message }, 500);
  }
});
app.post("/api/talent-pool/:id/notify-interview", authMiddleware, async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const name = body?.name || "\u5019\u9009\u4EBA";
    const position = body?.position || "";
    const requisitionTableId = getBitableTableId(c.env, "requisition");
    const reqs = await bitableListRecords(c.env, requisitionTableId);
    const matched = reqs.find((r) => {
      const f = r.fields || {};
      const posName = f["\u62DB\u8058\u5C97\u4F4D"] ? Array.isArray(f["\u62DB\u8058\u5C97\u4F4D"]) ? String(f["\u62DB\u8058\u5C97\u4F4D"][0] || "") : String(f["\u62DB\u8058\u5C97\u4F4D"]) : "";
      return position && posName.includes(position);
    });
    const interviewers = [];
    if (matched) {
      const f = matched.fields || {};
      const hrNames = getUserName(f["HR\u4E8C\u9762"]);
      const bizNames = getUserName(f["\u4E1A\u52A1\u4E00\u9762"]);
      if (hrNames) interviewers.push(hrNames);
      if (bizNames) interviewers.push(bizNames);
    }
    const token = await getFeishuToken(c.env);
    const chatId = FEISHU_CONFIG.recruitmentGroupChatId;
    if (chatId) {
      const msg = {
        msg_type: "interactive",
        content: JSON.stringify({
          config: { wide_screen_mode: true },
          header: { title: { tag: "plain_text", content: `\u{1F3AF} \u9762\u8BD5\u5B89\u6392\u63D0\u9192` }, template: "blue" },
          elements: [
            { tag: "div", text: { tag: "lark_md", content: `**\u5019\u9009\u4EBA\uFF1A** ${name}
**\u9762\u8BD5\u5C97\u4F4D\uFF1A** ${position || "\u672A\u6307\u5B9A"}` } },
            { tag: "hr" },
            { tag: "div", text: { tag: "lark_md", content: `\u8BF7\u76F8\u5173\u9762\u8BD5\u5B98\u5C3D\u5FEB\u5B89\u6392\u9762\u8BD5\u3002` } },
            { tag: "note", elements: [{ tag: "plain_text", content: `\u6765\u81EA AI \u667A\u80FD\u9762\u8BD5\u7CFB\u7EDF` }] }
          ]
        })
      };
      await fetch(`https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=chat_id`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ receive_id: chatId, ...msg })
      });
    }
    return c.json({ ok: true, detail: `\u5DF2\u901A\u77E5\u9762\u8BD5\u5B98\u5B89\u6392 ${name} \u7684\u9762\u8BD5` });
  } catch (e) {
    return c.json({ detail: "\u901A\u77E5\u5931\u8D25: " + e.message }, 500);
  }
});
app.post("/api/interviews/:id/evaluate", authMiddleware, async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const { evaluation, result } = body;
    if (!evaluation && !result) {
      return c.json({ detail: "\u8BF7\u586B\u5199\u8BC4\u4EF7\u6216\u9009\u62E9\u7ED3\u679C" }, 400);
    }
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
    return c.json({ ok: true, detail: "\u8BC4\u4EF7\u5DF2\u63D0\u4EA4" });
  } catch (e) {
    return c.json({ detail: "\u63D0\u4EA4\u5931\u8D25: " + e.message }, 500);
  }
});
app.post("/api/interviews/create-from-talent", authMiddleware, async (c) => {
  try {
    const body = await c.req.json();
    const { candidate_name, position_applied, feishu_record_id } = body;
    if (!candidate_name) {
      return c.json({ detail: "\u7F3A\u5C11\u5019\u9009\u4EBA\u4FE1\u606F" }, 400);
    }
    const talentTableId = getBitableTableId(c.env, "talent");
    let interviewerOpenIds = [];
    let interviewerNames = [];
    let interviewerEmails = [];
    let talentRecord = null;
    if (feishu_record_id) {
      talentRecord = await bitableGetRecord(c.env, talentTableId, feishu_record_id);
    }
    if (!talentRecord) {
      const allRecords = await bitableListRecords(c.env, talentTableId);
      talentRecord = allRecords.find((r) => {
        const f = r.fields || {};
        return getFirstValue(f["\u59D3\u540D"]) === candidate_name;
      });
    }
    if (talentRecord) {
      const f = talentRecord.fields || {};
      const bizUsers = extractFeishuUsers(f["\u4E1A\u52A1\u8D1F\u8D23\u4EBA"]);
      const secondUsers = extractFeishuUsers(f["\u4E8C\u9762\u8D1F\u8D23\u4EBA"]);
      const thirdUsers = extractFeishuUsers(f["\u4E09\u9762\u8D1F\u8D23\u4EBA"]);
      for (const u of [...bizUsers, ...secondUsers, ...thirdUsers]) {
        if (u.open_id && !interviewerOpenIds.includes(u.open_id)) {
          interviewerOpenIds.push(u.open_id);
          interviewerNames.push(u.name);
          if (u.email) interviewerEmails.push(u.email);
        }
      }
    }
    if (interviewerNames.length === 0) {
      const requisitionTableId = getBitableTableId(c.env, "requisition");
      const reqs = await bitableListRecords(c.env, requisitionTableId);
      const matched = reqs.find((r) => {
        const posName = getFirstValue(r.fields?.["\u62DB\u8058\u5C97\u4F4D"]) || "";
        return position_applied && posName.includes(position_applied);
      });
      if (matched) {
        const mf = matched.fields || {};
        const hrName = getFirstValue(mf["HR\u4E8C\u9762"]) || "";
        const bizName = getFirstValue(mf["\u4E1A\u52A1\u4E00\u9762"]) || "";
        if (hrName) interviewerNames.push(hrName);
        if (bizName) interviewerNames.push(bizName);
      }
    }
    const interviewId = crypto.randomUUID();
    const interviewerStr = interviewerNames.length > 0 ? interviewerNames.join(", ") : "\u5F85\u5206\u914D";
    await c.env.DB.prepare(
      `INSERT INTO interviews (id, resume_id, interviewer, position_id, status, created_at, comments)
       VALUES (?, ?, ?, ?, 'scheduled', datetime('now'), ?)`
    ).bind(interviewId, feishu_record_id || "", candidate_name, position_applied || "", interviewerStr).run();
    if (interviewerOpenIds.length > 0) {
      c.executionCtx.waitUntil((async () => {
        try {
          const token = await getFeishuToken(c.env);
          for (const openId of interviewerOpenIds) {
            const cardContent = {
              config: { wide_screen_mode: true },
              header: { title: { tag: "plain_text", content: `\u{1F3AF} \u9762\u8BD5\u5B89\u6392\u901A\u77E5` }, template: "blue" },
              elements: [
                { tag: "div", text: { tag: "lark_md", content: `**\u5019\u9009\u4EBA\uFF1A** ${candidate_name}
**\u9762\u8BD5\u5C97\u4F4D\uFF1A** ${position_applied || "\u672A\u6307\u5B9A"}
**\u9762\u8BD5\u8F6E\u6B21\uFF1A** \u7B2C1\u8F6E` } },
                { tag: "hr" },
                { tag: "div", text: { tag: "lark_md", content: `\u8BF7\u53CA\u65F6\u767B\u5F55\u7CFB\u7EDF\u67E5\u770B\u5019\u9009\u4EBA\u7B80\u5386\u5E76\u51C6\u5907\u9762\u8BD5\u3002\u9762\u8BD5\u7ED3\u675F\u540E\u8BF7\u5728\u7CFB\u7EDF\u5185\u586B\u5199\u9762\u8BD5\u8BC4\u4EF7\u3002` } },
                { tag: "action", actions: [{ tag: "button", text: { tag: "plain_text", content: "\u{1F50D} \u67E5\u770B\u5019\u9009\u4EBA" }, type: "primary", url: `https://ai-interview-22u.pages.dev/talent-pool` }] },
                { tag: "note", elements: [{ tag: "plain_text", content: `\u6765\u81EA AI \u667A\u80FD\u9762\u8BD5\u7CFB\u7EDF` }] }
              ]
            };
            const resp = await fetch(`https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=open_id`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
              body: JSON.stringify({
                receive_id: openId,
                msg_type: "interactive",
                content: JSON.stringify(cardContent)
              })
            });
            const result = await resp.json();
            if (!result.code || result.code !== 0) {
              console.error(`\u53D1\u9001\u98DE\u4E66\u6D88\u606F\u7ED9 ${openId} \u5931\u8D25: ${JSON.stringify(result)}`);
            }
          }
        } catch (e) {
          console.error(`\u901A\u77E5\u9762\u8BD5\u5B98\u5931\u8D25: ${e.message}`);
        }
      })());
    }
    const row = await c.env.DB.prepare("SELECT * FROM interviews WHERE id = ?").bind(interviewId).first();
    return c.json({
      ...row,
      resume: { candidate_name },
      position: { title: position_applied || "\u672A\u77E5\u5C97\u4F4D" },
      interviewer_list: interviewerNames
    });
  } catch (e) {
    return c.json({ detail: "\u521B\u5EFA\u9762\u8BD5\u5931\u8D25: " + e.message }, 500);
  }
});
app.get("/api/resumes", authMiddleware, async (c) => {
  try {
    const tableId = getBitableTableId(c.env, "talent");
    const records = await bitableListRecords(c.env, tableId);
    const items = records.map(parseTalentRecord);
    const nameFilter = c.req.query("candidate_name");
    const statusFilter = c.req.query("status");
    let filtered = items;
    if (nameFilter) filtered = filtered.filter((i) => i.candidate_name?.includes(nameFilter));
    if (statusFilter) filtered = filtered.filter((i) => i.status === statusFilter);
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
    return c.json(parseTalentRecord(record));
  } catch (e) {
    return c.json({ detail: e.message }, 500);
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
  const systemPrompt = `You are an expert HR recruiter and resume parser. Parse the resume text and perform AI screening analysis. Return a JSON object with two sections:

Section 1 - Basic Info:
- candidate_name: full name
- email: email address (or null if not found)
- phone: phone number (or null if not found)
- highest_degree: highest education degree
- school: school name
- major: major
- years_of_experience: number
- skills: array of skills
- work_experience: array of { company, title, duration, description }
- education: array of { school, degree, major, duration }

Section 2 - AI Screening:
- position: the position the candidate applied for (extract from filename or text)
- advantage (\u4F18\u52BF\u5206\u6790): string describing 3-5 key strengths in Chinese
- risk (\u98CE\u9669\u70B9/\u52A3\u52BF\u5206\u6790): string describing 2-4 weaknesses or risks in Chinese
- match_score: integer 0-100 representing how well the candidate matches
- recommendation: one of "strongly_recommend", "recommend", "neutral", "not_recommend", "strongly_not_recommend"
- summary: brief analysis summary in Chinese (2-3 sentences)
- suggested_questions: array of 3-5 interview questions in Chinese`;
  try {
    const result = await callAI(c.env, systemPrompt, "Resume text:\n" + rawText);
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
app.post("/api/interviews/start-from-talent-pool/:talentId", authMiddleware, async (c) => {
  const talentId = c.req.param("talentId");
  const talent = await c.env.DB.prepare("SELECT * FROM talent_pool WHERE id = ?").bind(talentId).first();
  if (!talent) return c.json({ detail: "Talent not found" }, 404);
  const candidateName = talent.candidate_name || "\u672A\u77E5";
  const posName = talent.position_applied || talent.current_title || "\u672A\u77E5\u5C97\u4F4D";
  const resumeId = talent.resume_id || null;
  const city = talent.city || "";
  const aiEval = talent.ai_evaluation || "";
  const interviewId = uuid();
  await c.env.DB.prepare(
    `INSERT INTO interviews (id, resume_id, interviewer, status, created_at)
     VALUES (?, ?, ?, 'scheduled', ?)`
  ).bind(interviewId, resumeId, candidateName, now()).run();
  c.executionCtx.waitUntil((async () => {
    try {
      const token = await getFeishuToken(c.env);
      const fakeRecord = {
        candidate_name: candidateName,
        mapped_position: posName,
        position_applied: posName,
        city,
        ai_analysis: aiEval
      };
      await notifyInterviewersForCandidate(c.env, token, fakeRecord);
    } catch (e) {
      console.error(`\u901A\u77E5\u9762\u8BD5\u5B98\u5931\u8D25: ${e.message}`);
    }
  })());
  const row = await c.env.DB.prepare("SELECT * FROM interviews WHERE id = ?").bind(interviewId).first();
  return c.json({ ...transformRow(row), talent_id: talentId });
});
app.post("/api/interviews/:id/cancel", authMiddleware, async (c) => {
  const id = c.req.param("id");
  const interview = await c.env.DB.prepare("SELECT * FROM interviews WHERE id = ?").bind(id).first();
  if (!interview) return c.json({ detail: "Interview not found" }, 404);
  await c.env.DB.prepare("UPDATE interviews SET status = 'cancelled' WHERE id = ?").bind(id).run();
  const resumeId = interview.resume_id;
  if (resumeId) {
    const talent = await c.env.DB.prepare("SELECT * FROM talent_pool WHERE resume_id = ?").bind(resumeId).first();
    if (talent) {
      const feishuRecordId = talent.feishu_record_id;
      await c.env.DB.prepare("DELETE FROM talent_pool WHERE id = ?").bind(talent.id).run();
      if (feishuRecordId) {
        c.executionCtx.waitUntil((async () => {
          try {
            const token = await getFeishuToken(c.env);
            await fetch(`https://open.feishu.cn/open-apis/bitable/v1/apps/${FEISHU_CONFIG.appToken}/tables/${FEISHU_CONFIG.talentTableId}/records/${feishuRecordId}`, {
              method: "DELETE",
              headers: { "Authorization": `Bearer ${token}` }
            });
            console.log(`[Cancel] \u5DF2\u540C\u6B65\u5220\u9664\u98DE\u4E66\u4EBA\u624D\u5E93\u8BB0\u5F55: ${feishuRecordId}`);
          } catch (e) {
            console.error(`[Cancel] \u540C\u6B65\u5220\u9664\u98DE\u4E66\u8BB0\u5F55\u5931\u8D25: ${e.message}`);
          }
        })());
      }
    }
  }
  return c.json({ detail: "Interview cancelled, talent pool record removed" });
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
app.post("/api/talent-pool/:id/ai-recommend", authMiddleware, async (c) => {
  const id = c.req.param("id");
  const talent = await c.env.DB.prepare("SELECT * FROM talent_pool WHERE id = ?").bind(id).first();
  if (!talent) return c.json({ detail: "Talent not found" }, 404);
  const positions = await c.env.DB.prepare("SELECT id, title, department, requirements, salary_range, status FROM positions WHERE status IN ('open','published') ORDER BY created_at DESC LIMIT 20").all();
  const systemPrompt = `\u4F60\u662F\u4E00\u540D\u8D44\u6DF1\u730E\u5934 AI\u3002\u6839\u636E\u5019\u9009\u4EBA\u80CC\u666F\u548C\u73B0\u6709\u5728\u62DB\u5C97\u4F4D,\u63A8\u8350\u6700\u5408\u9002\u7684\u5C97\u4F4D\u5E76\u8BF4\u660E\u7406\u7531\u3002\u53EA\u7528\u4E2D\u6587\u56DE\u7B54\u3002\u8FD4\u56DE JSON \u6570\u7EC4,\u6BCF\u9879\u542B {"position_id": "\u5C97\u4F4DID", "position_title": "\u5C97\u4F4D\u540D\u79F0", "match_score": 0-100\u6574\u6570, "reason": "\u63A8\u8350\u7406\u7531"}\u3002\u4E0D\u8981\u5305\u542B markdown \u4EE3\u7801\u5757\u6807\u8BB0\u6216\u989D\u5916\u8BF4\u660E\u3002`;
  const candidateInfo = { name: talent.candidate_name, current_title: talent.current_title, skills: talent.skills, experience_years: talent.experience_years, education: talent.education, expected_salary: talent.expected_salary, tags: talent.tags };
  const userPrompt = `\u5019\u9009\u4EBA\u4FE1\u606F:
${JSON.stringify(candidateInfo, null, 2)}

\u5728\u62DB\u5C97\u4F4D\u5217\u8868:
${JSON.stringify(positions.results.map((p) => ({ id: p.id, title: p.title, department: p.department, requirements: p.requirements, salary_range: p.salary_range })), null, 2)}

\u8BF7\u63A8\u8350\u6700\u5339\u914D\u7684\u5C97\u4F4D(\u6700\u591A5\u4E2A),\u6309\u5339\u914D\u5EA6\u4ECE\u9AD8\u5230\u4F4E\u6392\u5E8F\u3002`;
  try {
    const result = await callAI(c.env, systemPrompt, userPrompt, "deepseek-v4-flash");
    let recommendations;
    try {
      recommendations = extractJSON(result);
      if (!Array.isArray(recommendations)) recommendations = [recommendations];
    } catch {
      recommendations = [];
    }
    return c.json({ talent_id: id, recommendations });
  } catch (err) {
    return c.json({ detail: "AI recommend failed", error: err.message }, 500);
  }
});
app.post("/api/probation/:id/ai-assessment", authMiddleware, async (c) => {
  const id = c.req.param("id");
  const record = await c.env.DB.prepare("SELECT * FROM probation_records WHERE id = ?").bind(id).first();
  if (!record) return c.json({ detail: "Probation record not found" }, 404);
  let reviews = [];
  try {
    reviews = JSON.parse(record.monthly_reviews || "[]");
  } catch {
  }
  let position = null;
  if (record.position_id) position = await c.env.DB.prepare("SELECT title, requirements FROM positions WHERE id = ?").bind(record.position_id).first();
  const systemPrompt = `\u4F60\u662F\u4E00\u540D\u8D44\u6DF1 HR \u987E\u95EE AI\u3002\u6839\u636E\u5458\u5DE5\u8BD5\u7528\u671F\u6708\u5EA6\u8BC4\u5BA1\u8BB0\u5F55,\u751F\u6210\u8BD5\u7528\u671F\u7EFC\u5408\u8BC4\u4F30\u62A5\u544A\u3002\u7528\u4E2D\u6587\u56DE\u7B54,\u4F7F\u7528 Markdown \u683C\u5F0F,\u5305\u542B:## \u603B\u4F53\u8868\u73B0\u3001## \u4F18\u52BF\u3001## \u4E0D\u8DB3\u4E0E\u6539\u8FDB\u3001## \u8F6C\u6B63\u5EFA\u8BAE(\u660E\u786E\u7ED9\u51FA\u5EFA\u8BAE\u8F6C\u6B63/\u5EF6\u957F\u8BD5\u7528\u671F/\u4E0D\u4E88\u8F6C\u6B63\u53CA\u7406\u7531)\u3002`;
  const userPrompt = `\u5458\u5DE5: ${record.employee_name}
\u5C97\u4F4D: ${position?.title || "\u672A\u77E5"}
\u5C97\u4F4D\u8981\u6C42: ${position?.requirements || "\u65E0"}
\u8BD5\u7528\u671F\u6708\u6570: ${record.probation_months || 3}

\u6708\u5EA6\u8BC4\u5BA1\u8BB0\u5F55:
${reviews.length > 0 ? JSON.stringify(reviews, null, 2) : "\u6682\u65E0\u6708\u5EA6\u8BC4\u5BA1\u8BB0\u5F55"}

\u8BF7\u751F\u6210\u8BD5\u7528\u671F\u7EFC\u5408\u8BC4\u4F30\u62A5\u544A\u3002`;
  try {
    const assessment = await callAI(c.env, systemPrompt, userPrompt, "deepseek-v4-flash");
    await c.env.DB.prepare("UPDATE probation_records SET final_assessment = ?, updated_at = ? WHERE id = ?").bind(assessment, now(), id).run();
    const row = await c.env.DB.prepare("SELECT * FROM probation_records WHERE id = ?").bind(id).first();
    return c.json(transformRow(row));
  } catch (err) {
    return c.json({ detail: "AI assessment failed", error: err.message }, 500);
  }
});
app.post("/api/requisitions/:id/ai-jd", authMiddleware, async (c) => {
  const id = c.req.param("id");
  const req = await c.env.DB.prepare("SELECT * FROM job_requisitions WHERE id = ?").bind(id).first();
  if (!req) return c.json({ detail: "Requisition not found" }, 404);
  const systemPrompt = `\u4F60\u662F\u4E00\u540D\u8D44\u6DF1\u62DB\u8058\u4E13\u5BB6\u3002\u6839\u636E\u62DB\u8058\u9700\u6C42\u4FE1\u606F\u751F\u6210\u4E13\u4E1A\u7684\u804C\u4F4D\u63CF\u8FF0\u548C\u4EFB\u804C\u8981\u6C42\u3002\u53EA\u7528\u4E2D\u6587\u56DE\u7B54\u3002\u8FD4\u56DE\u4E25\u683C\u7684 JSON: {"description": "\u8BE6\u7EC6\u804C\u8D23\u63CF\u8FF0", "requirements": "\u4EFB\u804C\u8981\u6C42,\u591A\u6761\u7528\u6362\u884C\u5206\u9694"}\u3002\u4E0D\u8981\u5305\u542B markdown \u4EE3\u7801\u5757\u6807\u8BB0\u6216\u989D\u5916\u8BF4\u660E\u3002`;
  const userPrompt = `\u804C\u4F4D\u540D\u79F0: ${req.title}
\u90E8\u95E8: ${req.department}
\u62DB\u8058\u4EBA\u6570: ${req.headcount || 1}
\u7528\u5DE5\u7C7B\u578B: ${req.employment_type || "full_time"}
\u85AA\u8D44\u8303\u56F4: ${req.salary_range || "\u9762\u8BAE"}
\u7D27\u6025\u7A0B\u5EA6: ${req.urgency || "medium"}
\u73B0\u6709\u63CF\u8FF0: ${req.description || "\u65E0"}
\u73B0\u6709\u8981\u6C42: ${req.requirements || "\u65E0"}

\u8BF7\u751F\u6210\u6216\u5B8C\u5584\u8BE5\u804C\u4F4D\u7684\u63CF\u8FF0\u548C\u4EFB\u804C\u8981\u6C42\u3002`;
  try {
    const result = await callAI(c.env, systemPrompt, userPrompt, "deepseek-v4-flash");
    let parsed;
    try {
      parsed = extractJSON(result);
    } catch {
      parsed = { description: result, requirements: "" };
    }
    await c.env.DB.prepare("UPDATE job_requisitions SET description = ?, requirements = ?, updated_at = ? WHERE id = ?").bind(parsed.description || "", parsed.requirements || "", now(), id).run();
    const row = await c.env.DB.prepare("SELECT * FROM job_requisitions WHERE id = ?").bind(id).first();
    return c.json(transformRow(row));
  } catch (err) {
    return c.json({ detail: "AI generate failed", error: err.message }, 500);
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
app.post("/api/talent-pool/:id/contact", authMiddleware, async (c) => {
  const id = c.req.param("id");
  await c.env.DB.prepare("UPDATE talent_pool SET status = 'contacted', last_contacted_at = ? WHERE id = ?").bind(now(), id).run();
  const row = await c.env.DB.prepare("SELECT * FROM talent_pool WHERE id = ?").bind(id).first();
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
app.get("/api/settings/system", authMiddleware, async (c) => {
  const row = await c.env.DB.prepare("SELECT * FROM system_configs ORDER BY updated_at DESC LIMIT 1").first();
  if (!row) return c.json({});
  return c.json(transformRow(row));
});
app.put("/api/settings/system", authMiddleware, async (c) => {
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
  if (!row?.prompt_configs) return c.json({});
  try {
    return c.json(JSON.parse(row.prompt_configs));
  } catch {
    return c.json({});
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
  return c.json([]);
});
app.put("/api/settings/prompts/:key", authMiddleware, async (c) => {
  return c.json({ detail: "Prompt updated" });
});
app.post("/api/settings/mail/test", authMiddleware, async (c) => {
  return c.json({ detail: "Mail sending not available in serverless mode" });
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
    "talent_pool",
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
  const counts = {};
  const tables = ["positions", "resumes", "interviews", "users", "job_requisitions"];
  for (const table of tables) {
    const r = await c.env.DB.prepare(`SELECT COUNT(*) as cnt FROM ${table}`).first();
    counts[table] = r?.cnt ?? 0;
  }
  return c.json(counts);
});
registerCrud("position-mappings", "position_mappings", { raw_name: "like", mapped_name: "like" });
registerCrud("capability-dimensions", "capability_dimensions", { position_name: "like" });
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
  const tpId = uuid();
  await c.env.DB.prepare(
    `INSERT INTO talent_pool (id, resume_id, candidate_name, email, phone, current_title, skills, experience_years, education, expected_salary, source, tags, status, notes, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(
    tpId,
    record.resume_id || null,
    record.candidate_name,
    "",
    "",
    record.position_applied || "",
    "[]",
    0,
    record.education || "",
    "",
    "\u90AE\u7BB1\u521D\u7B5B",
    JSON.stringify(["AI\u521D\u7B5B"]),
    "available",
    record.ai_analysis || "",
    now(),
    now()
  ).run();
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
  return c.json({ ...transformRow(row), talent_pool_id: tpId });
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
  const result = await c.env.DB.prepare("SELECT * FROM daily_reports ORDER BY created_at DESC LIMIT 100").all();
  return c.json(result.results.map(transformRow));
});
app.post("/api/daily-reports/generate", authMiddleware, async (c) => {
  const body = await c.req.json().catch(() => ({})) || {};
  const reportType = body.report_type || "progress";
  const reportDate = body.report_date || (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
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
  } catch (e) {
    aiSummary = "(AI\u6458\u8981\u751F\u6210\u5931\u8D25)";
  }
  const content = JSON.stringify(stats);
  const title = `\u62DB\u8058\u65E5\u62A5 - ${reportDate}`;
  const id = uuid();
  await c.env.DB.prepare(
    "INSERT INTO daily_reports (id, report_date, report_type, title, content, stats, status, created_at) VALUES (?,?,?,?,?,?,?,?)"
  ).bind(id, reportDate, reportType, title, content, aiSummary, "generated", now()).run();
  const row = await c.env.DB.prepare("SELECT * FROM daily_reports WHERE id = ?").bind(id).first();
  return c.json(transformRow(row));
});
app.delete("/api/daily-reports/:id", authMiddleware, async (c) => {
  await c.env.DB.prepare("DELETE FROM daily_reports WHERE id = ?").bind(c.req.param("id")).run();
  return c.json({ detail: "Report deleted" });
});
async function getFeishuToken(env) {
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
  return data.tenant_access_token;
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
          const total = await c.env.DB.prepare("SELECT COUNT(*) as c FROM talent_pool").first();
          const pending = await c.env.DB.prepare("SELECT COUNT(*) as c FROM resume_screening_queue WHERE status='pending'").first();
          const approved = await c.env.DB.prepare("SELECT COUNT(*) as c FROM resume_screening_queue WHERE status='approved'").first();
          await replyText(
            `\u{1F4CA} \u62DB\u8058\u7EDF\u8BA1
\u4EBA\u624D\u5E93: ${total?.c || 0} \u4EBA
\u5F85\u5BA1\u6838: ${pending?.c || 0} \u4EBA
\u4ECA\u65E5\u5165\u5E93: ${approved?.c || 0} \u4EBA`
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
          const total = await c.env.DB.prepare("SELECT COUNT(*) as c FROM talent_pool").first();
          const pending = await c.env.DB.prepare("SELECT COUNT(*) as c FROM resume_screening_queue WHERE status='pending'").first();
          await replyText(`\u{1F4CA} \u62DB\u8058\u7EDF\u8BA1
\u4EBA\u624D\u5E93: ${total?.c || 0} \u4EBA
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
            const total = await c.env.DB.prepare("SELECT COUNT(*) as c FROM talent_pool").first();
            const pend = await c.env.DB.prepare("SELECT COUNT(*) as c FROM resume_screening_queue WHERE status='pending'").first();
            const appr = await c.env.DB.prepare("SELECT COUNT(*) as c FROM resume_screening_queue WHERE status='approved'").first();
            await reply(`\u{1F4CA} **\u62DB\u8058\u8FDB\u5EA6**
\u4EBA\u624D\u5E93: ${total?.c || 0} \u4EBA
\u5F85\u5BA1\u6838: ${pend?.c || 0} \u4EBA
\u5DF2\u5165\u5E93: ${appr?.c || 0} \u4EBA`);
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
    const todayStart = `${dateStr} 00:00:00`;
    const todayEnd = `${dateStr} 23:59:59`;
    const newCount = await c.env.DB.prepare(
      "SELECT COUNT(*) as c FROM resume_screening_queue WHERE created_at >= ? AND created_at <= ?"
    ).bind(todayStart, todayEnd).first();
    const approvedCount = await c.env.DB.prepare(
      "SELECT COUNT(*) as c FROM resume_screening_queue WHERE status = 'approved' AND updated_at >= ? AND updated_at <= ?"
    ).bind(todayStart, todayEnd).first();
    const rejectedCount = await c.env.DB.prepare(
      "SELECT COUNT(*) as c FROM resume_screening_queue WHERE status = 'rejected' AND updated_at >= ? AND updated_at <= ?"
    ).bind(todayStart, todayEnd).first();
    const pendingCount = await c.env.DB.prepare(
      "SELECT COUNT(*) as c FROM resume_screening_queue WHERE status = 'pending'"
    ).first();
    const talentCount = await c.env.DB.prepare(
      "SELECT COUNT(*) as c FROM talent_pool"
    ).first();
    const chatId = FEISHU_CONFIG.recruitmentGroupChatId;
    if (chatId) {
      const token = await getFeishuToken(c.env);
      const cardContent = {
        config: { wide_screen_mode: true },
        header: {
          title: { tag: "plain_text", content: `\u{1F4CA} \u62DB\u8058\u65E5\u62A5 ${dateStr}` },
          template: "blue"
        },
        elements: [
          {
            tag: "div",
            text: {
              tag: "lark_md",
              content: [
                `\u{1F4C5} **\u65E5\u671F\uFF1A** ${dateStr}`,
                "",
                `**\u{1F4CB} \u4ECA\u65E5\u6570\u636E**`,
                `\u65B0\u8FDB\u521D\u7B5B\uFF1A**${newCount?.c || 0}** \u4EBA`,
                `\u5DF2\u5165\u5E93\uFF1A**${approvedCount?.c || 0}** \u4EBA`,
                `\u5DF2\u6DD8\u6C70\uFF1A**${rejectedCount?.c || 0}** \u4EBA`,
                "",
                `**\u{1F4E6} \u7D2F\u8BA1\u6570\u636E**`,
                `\u5F85\u5BA1\u6838\uFF1A**${pendingCount?.c || 0}** \u4EBA`,
                `\u4EBA\u624D\u5E93\u603B\u6570\uFF1A**${talentCount?.c || 0}** \u4EBA`
              ].join("\n")
            }
          },
          { tag: "hr" },
          {
            tag: "note",
            elements: [{ tag: "plain_text", content: `\u7CFB\u7EDF\u81EA\u52A8\u751F\u6210 | ${today.toLocaleString("zh-CN")}` }]
          }
        ]
      };
      await sendFeishuMessageToChat(token, chatId, cardContent);
    }
    return c.json({
      ok: true,
      data: {
        date: dateStr,
        new: newCount?.c || 0,
        approved: approvedCount?.c || 0,
        rejected: rejectedCount?.c || 0,
        pending: pendingCount?.c || 0,
        talentPool: talentCount?.c || 0
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
function buildInterviewerCard(name, position, city, analysis) {
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
        elements: [{ tag: "plain_text", content: "\u8BF7\u5728\u7CFB\u7EDF\u4E2D\u67E5\u770B\u5B8C\u6574\u8BC4\u4F30\u5E76\u8FDB\u884C\u9762\u8BD5\u5B89\u6392\u3002" }]
      }
    ]
  };
}
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
async function notifyInterviewersForCandidate(env, token, record) {
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
        const cardContent = buildInterviewerCard(record.candidate_name, posName, record.city, record.ai_analysis);
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
        const openId = FEISHU_CONFIG.interviewerOpenIds?.[name] || FEISHU_CONFIG.defaultHrOpenId;
        const cardContent = buildInterviewerCard(record.candidate_name, posName, record.city, record.ai_analysis);
        await sendFeishuMessageToUser(token, openId, cardContent);
        console.log(`[NotifyInterviewers] \u2705 \u5DF2\u901A\u77E5 ${name} (${openId}) - ${record.candidate_name}`);
      }
    }
  } catch (e) {
    console.error(`[NotifyInterviewers] \u901A\u77E5\u5931\u8D25: ${e.message}`);
  }
}
app.post("/api/resume-screening/:id/notify-interviewers", authMiddleware, async (c) => {
  const id = c.req.param("id");
  const record = await c.env.DB.prepare("SELECT * FROM resume_screening_queue WHERE id = ?").bind(id).first();
  if (!record) return c.json({ detail: "\u8BB0\u5F55\u4E0D\u5B58\u5728" }, 404);
  try {
    const token = await getFeishuToken(c.env);
    await notifyInterviewersForCandidate(c.env, token, record);
    return c.json({ ok: true, message: `\u5DF2\u901A\u77E5\u5BF9\u5E94\u9762\u8BD5\u5B98: ${record.candidate_name}` });
  } catch (err) {
    return c.json({ detail: `\u901A\u77E5\u5931\u8D25: ${err.message}` }, 500);
  }
});
app.get("/api", (c) => c.json({ status: "ok", service: "ai-interview-api" }));
app.all("*", async (c) => {
  if (c.env.ASSETS) {
    return c.env.ASSETS.fetch(c.req.raw);
  }
  return c.notFound();
});
var index_default = app;
export {
  index_default as default
};
