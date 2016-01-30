"use strict";

/**
 * Key-value bucket handler
 */

// TODO: move to separate spec package
var yaml = require('js-yaml');
var fs = require('fs');
var spec = yaml.safeLoad(fs.readFileSync(__dirname + '/post_data.yaml'));
var crypto = require('crypto');
var stringify = require('json-stable-stringify');
var URI = require('swagger-router').URI;

function PostDataBucket(options) {
    this.log = options.log || function() {};
}

PostDataBucket.prototype.createBucket = function(hyper, req) {
    var rp = req.params;
    return hyper.put({
        uri: new URI([rp.domain, 'sys', 'key_value', rp.bucket]),
        body: {
            keyType: 'string',
            valueType: 'json'
        }
    });
};

PostDataBucket.prototype.getRevision = function(hyper, req) {
    var rp = req.params;
    var path = [rp.domain, 'sys', 'key_value', rp.bucket, rp.key];
    if (rp.tid) {
        path.push(rp.tid);
    }
    return hyper.get({
        uri: new URI(path),
        headers: {
            'cache-control': req.headers && req.headers['cache-control']
        }
    });
};

function calculateHash(storedData) {
    return crypto.createHash('sha1')
                 .update(stringify(storedData))
                 .digest('hex');
}

PostDataBucket.prototype.putRevision = function(hyper, req) {
    var rp = req.params;
    var storedData = req.body || {};
    var key = calculateHash(storedData);
    req.params.key = key;
    return this.getRevision(hyper, req)
    .then(function() {
        return {
            status: 200,
            headers: {
                'content-type': 'text/plain'
            },
            body: key
        };
    })
    .catch({ status: 404 }, function() {
        return hyper.put({
            uri: new URI([rp.domain, 'sys', 'key_value', rp.bucket, key]),
            headers: {
                'content-type': 'application/json',
            },
            body: storedData
        })
        .then(function(res) {
            return {
                status: res.status,
                headers: {
                    'content-type': 'text/plain'
                },
                body: key
            };
        });
    });

};

module.exports = function(options) {
    var postDataBucket = new PostDataBucket(options);

    return {
        spec: spec, // Re-export from spec module
        operations: {
            createBucket: postDataBucket.createBucket.bind(postDataBucket),
            getRevision: postDataBucket.getRevision.bind(postDataBucket),
            putRevision: postDataBucket.putRevision.bind(postDataBucket)
        }
    };
};