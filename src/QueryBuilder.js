'use strict';

class QueryBuilder {
  constructor() {
    this._params = new Map();
    this._typeCounts = {};
    this._groupCount = 0;
  }

  // --- Internal helpers ---

  _count(type) {
    this._typeCounts[type] = (this._typeCounts[type] || 0) + 1;
    return this._typeCounts[type];
  }

  _set(key, value) {
    this._params.set(key, String(value));
    return this;
  }

  _predicatePrefix(type) {
    const i = this._count(type);
    return i === 1 ? type : `${i}_${type}`;
  }

  // --- Predicates ---

  /** Filter by JCR node type, e.g. 'cq:Page', 'dam:Asset' */
  type(nodeType) {
    return this._set('type', nodeType);
  }

  /** Filter by node path */
  path(searchPath, { exact = false, self = false, flat = false } = {}) {
    this._set('path', searchPath);
    if (exact) this._set('path.exact', 'true');
    if (self)  this._set('path.self', 'true');
    if (flat)  this._set('path.flat', 'true');
    return this;
  }

  /**
   * Filter by a JCR property value.
   * @param {string} name     - Property path, e.g. 'jcr:content/cq:template'
   * @param {string} [value]  - Expected value
   * @param {object} [opts]
   * @param {string} [opts.operation]  - 'equals'|'unequals'|'like'|'not'|'exists'|'not_exists'
   * @param {boolean}[opts.and]        - true to AND multiple values (default is OR)
   * @param {string} [opts.depth]      - Relative-path search depth
   */
  property(name, value, { operation, and, depth } = {}) {
    const p = this._predicatePrefix('property');
    this._set(p, name);
    if (value !== undefined)  this._set(`${p}.value`, value);
    if (operation !== undefined) this._set(`${p}.operation`, operation);
    if (and !== undefined)    this._set(`${p}.and`, and ? 'true' : 'false');
    if (depth !== undefined)  this._set(`${p}.depth`, depth);
    return this;
  }

  /** Full-text search */
  fulltext(text, relPath) {
    this._set('fulltext', text);
    if (relPath) this._set('fulltext.relPath', relPath);
    return this;
  }

  /**
   * Filter by date range on a property.
   * @param {string} propertyPath - e.g. 'jcr:content/jcr:lastModified'
   * @param {object} opts
   * @param {string} [opts.lowerBound]       - ISO date string
   * @param {string} [opts.upperBound]       - ISO date string
   * @param {string} [opts.lowerOperation]   - '>=' (default) or '>'
   * @param {string} [opts.upperOperation]   - '<=' (default) or '<'
   * @param {string} [opts.timezone]         - e.g. 'GMT+01:00'
   */
  dateRange(propertyPath, { lowerBound, upperBound, lowerOperation, upperOperation, timezone } = {}) {
    const p = this._predicatePrefix('daterange');
    this._set(`${p}.property`, propertyPath);
    if (lowerBound)     this._set(`${p}.lowerBound`, lowerBound);
    if (upperBound)     this._set(`${p}.upperBound`, upperBound);
    if (lowerOperation) this._set(`${p}.lowerOperation`, lowerOperation);
    if (upperOperation) this._set(`${p}.upperOperation`, upperOperation);
    if (timezone)       this._set(`${p}.timezone`, timezone);
    return this;
  }

  /** Filter by a CQ tag ID, e.g. 'marketing:interest/product' */
  tag(tagId) {
    const p = this._predicatePrefix('tagid');
    return this._set(p, tagId);
  }

  /** Filter by node name (supports wildcards: '*', '?') */
  nodeName(name) {
    const p = this._predicatePrefix('nodename');
    return this._set(p, name);
  }

  /**
   * Add a predicate group (AND between groups; use { or: true } for OR within).
   * @param {function} builderFn - Receives a QueryBuilder to define group predicates
   * @param {object}   [opts]
   * @param {boolean}  [opts.or]   - OR conditions inside the group
   * @param {boolean}  [opts.not]  - Negate the group
   */
  group(builderFn, { or = false, not = false } = {}) {
    const inner = new QueryBuilder();
    builderFn(inner);

    const i = ++this._groupCount;
    const prefix = `${i}_group`;

    if (or)  this._set(`${prefix}.p.or`, 'true');
    if (not) this._set(`${prefix}.p.not`, 'true');

    for (const [key, value] of inner._params) {
      this._set(`${prefix}.${key}`, value);
    }
    return this;
  }

  // --- Pagination & ordering ---

  /** Max number of results (-1 for all) */
  limit(n) {
    return this._set('p.limit', n);
  }

  /** Result offset for pagination */
  offset(n) {
    return this._set('p.offset', n);
  }

  /** Return an estimate of the total count */
  guessTotal(val = true) {
    return this._set('p.guessTotal', val ? 'true' : 'false');
  }

  /**
   * Sort results.
   * @param {string} property  - e.g. '@jcr:created' or 'path'
   * @param {'asc'|'desc'} direction
   */
  orderBy(property, direction = 'asc') {
    this._set('orderby', property);
    this._set('orderby.sort', direction);
    return this;
  }

  // --- Output ---

  /** Returns the query as a plain key-value object */
  toParams() {
    return Object.fromEntries(this._params);
  }

  /** Returns the query as a URL query string */
  toQueryString() {
    return new URLSearchParams(this._params).toString();
  }

  /**
   * Execute the query against a live AEM instance.
   * Requires Node 18+ (built-in fetch) or a fetch polyfill.
   *
   * @param {string} aemHost  - e.g. 'http://localhost:4502'
   * @param {object} [creds]
   * @param {string} [creds.username='admin']
   * @param {string} [creds.password='admin']
   */
  async execute(aemHost, { username = 'admin', password = 'admin' } = {}) {
    const url = `${aemHost}/bin/querybuilder.json?${this.toQueryString()}`;
    const auth = Buffer.from(`${username}:${password}`).toString('base64');

    const response = await fetch(url, {
      headers: { Authorization: `Basic ${auth}` },
    });

    if (!response.ok) {
      throw new Error(`AEM query failed: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }
}

module.exports = { QueryBuilder };
