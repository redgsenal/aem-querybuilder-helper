'use strict';

const { QueryBuilder } = require('../index');

// --- Example 1: Find pages under a path with a specific template ---
const pageQuery = new QueryBuilder()
  .type('cq:Page')
  .path('/content/mysite/en')
  .property('jcr:content/cq:template', '/conf/mysite/settings/wcm/templates/article-page')
  .orderBy('@jcr:created', 'desc')
  .limit(10)
  .offset(0)
  .guessTotal();

console.log('=== Page Query ===');
console.log('Params:', pageQuery.toParams());
console.log('QueryString:', pageQuery.toQueryString());
console.log();

// --- Example 2: Full-text search on assets ---
const assetQuery = new QueryBuilder()
  .type('dam:Asset')
  .path('/content/dam/mysite')
  .fulltext('product launch')
  .limit(20);

console.log('=== Asset Full-text Query ===');
console.log('Params:', assetQuery.toParams());
console.log('QueryString:', assetQuery.toQueryString());
console.log();

// --- Example 3: Multiple properties (AND) ---
const multiPropQuery = new QueryBuilder()
  .type('cq:Page')
  .path('/content/mysite')
  .property('jcr:content/cq:tags', 'marketing:segment/enterprise')
  .property('jcr:content/jcr:title', 'Hello World')
  .limit(5);

console.log('=== Multiple Property Query ===');
console.log('Params:', multiPropQuery.toParams());
console.log('QueryString:', multiPropQuery.toQueryString());
console.log();

// --- Example 4: OR group (pages tagged with either tag) ---
const tagOrQuery = new QueryBuilder()
  .type('cq:Page')
  .path('/content/mysite')
  .group(
    (g) => g
      .tag('marketing:interest/product')
      .tag('marketing:interest/services'),
    { or: true }
  )
  .orderBy('@jcr:lastModified', 'desc')
  .limit(25);

console.log('=== Tag OR Group Query ===');
console.log('Params:', tagOrQuery.toParams());
console.log('QueryString:', tagOrQuery.toQueryString());
console.log();

// --- Example 5: Date range filter ---
const dateQuery = new QueryBuilder()
  .type('cq:Page')
  .path('/content/mysite')
  .dateRange('jcr:content/jcr:lastModified', {
    lowerBound: '2025-01-01T00:00:00.000Z',
    upperBound: '2025-12-31T23:59:59.000Z',
  })
  .limit(50);

console.log('=== Date Range Query ===');
console.log('Params:', dateQuery.toParams());
console.log('QueryString:', dateQuery.toQueryString());
console.log();

// --- Example 6: Complex query with multiple groups ---
const complexQuery = new QueryBuilder()
  .type('cq:Page')
  .path('/content/mysite')
  .group(
    (g) => g
      .property('jcr:content/cq:tags', 'marketing:segment/enterprise')
      .property('jcr:content/cq:tags', 'marketing:segment/mid-market'),
    { or: true }
  )
  .group(
    (g) => g
      .property('jcr:content/cq:template', '/conf/mysite/settings/wcm/templates/landing-page')
      .property('jcr:content/cq:template', '/conf/mysite/settings/wcm/templates/product-page'),
    { or: true }
  )
  .limit(10)
  .orderBy('path');

console.log('=== Complex Multi-Group Query ===');
console.log('Params:', complexQuery.toParams());
console.log('QueryString:', complexQuery.toQueryString());
console.log();

// --- Live execution example (commented out — needs a running AEM instance) ---
/*
async function runLiveQuery() {
  const results = await pageQuery.execute('http://localhost:4502', {
    username: 'admin',
    password: 'admin',
  });
  console.log('Hits:', results.hits);
  console.log('Total:', results.total);
}

runLiveQuery().catch(console.error);
*/
