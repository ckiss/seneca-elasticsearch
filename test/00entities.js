/* jshint indent: 2, asi: true, unused: false */
/* global describe, it, before, beforeEach, after, afterEach */
// vim: noai:ts=2:sw=2

var assert         = require('assert');
var should         = require('should');
var elasticsearch  = require('elasticsearch');
var _              = require('underscore');

var seneca = require('seneca')();
var indexName = 'seneca-test-entity';

seneca.use('mem-store',{ map:{ '-/-/foo':'*' }});

seneca.use('..', {
  refreshOnSave: true,
  fields: ['jobTitle'],
  connection: { index: indexName }
});

before(seneca.ready.bind(seneca));

describe('entities', function() {
  var esClient = new elasticsearch.Client();

  after(function(done) {
    esClient.indices.delete({index: indexName})
      .then(done.bind(null, null))
      .catch(done);
  });

  before(function() {
    var foo = this.foo = seneca.make$('foo');
    foo.id = 'john doe';
    foo.jobTitle = 'important sounding title';
    foo.passHash = 'DO NOT INDEX!';
  });

  it('should save entity', function(done) {
    this.foo.save$(throwOnError(done));
  });


  // need to debounce for 500ms to let the data get indexed.
  it('load', _.debounce(function(done) {
    var command = { role: 'search', cmd: 'load', index: indexName, type: 'foo' };
    command.data = { id: 'john doe' };

    seneca.act(command, loadCb);

    function loadCb(err, resp) {
      if (err) { throw err; }
      assert.ok(resp.exists);
      should.exist(resp._source);

      var src = resp._source;
      src.id.should.eql('john doe');
      src.jobTitle.should.eql('important sounding title');
      should.not.exist(src.passHash);

      done();
    }
  }, 500));


  it('should remove the entity', function(done) {
    this.foo.remove$(this.foo.id, throwOnError(done));
  });
});

function throwOnError(done) {
  return function(err) {
    if (err) { throw err; }
    done();
  };
}