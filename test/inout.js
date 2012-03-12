var JSRel = require('../jsrel');
var vows = require('vows');
var assert = require('assert');
var fs = require("fs");
var Table = JSRel.Table;

var artists = require(__dirname + '/data/artists');

var db = JSRel.use(__dirname + "/tmp/inout", {
  storage: 'file',
  schema: {
    user : {
      name: true,
      mail: true,
      age : 0,
      is_activated: "on",
      $indexes: "name",
      $uniques: [["name", "mail"]]
    },
    book : {
      title: true,
      ISBN : true,
      ASIN: true,
      price: 1,
      $indexes: "title",
      $uniques: ["ISBN", "ASIN"]
    },
    user_book: {
      u : "user",
      b : "book"
    },
    tag : {
      word: true,
      type: 1,
      is_activated: "on",
      $uniques: "word",
      $classes: ["is_activated", "type"]
    },
    book_tag : {
      b : "book",
      t : "tag"
    },
    artist: {
      name: true
    },
    song  : {
      title: true,
      rate : 1,
      artist: "artist",
      $indexes: "title"
    },

    song_tag: {
      song: "song",
      tag : "tag"
    }
  }
});

var tagTbl = db.table("tag");
fs.readFileSync(__dirname + '/data/genes', 'utf8').trim().split("\n").forEach(function(wd, k) {
  tagTbl.ins({word: wd, type: (k%5) +1});
});

var artistTbl  = db.table("artist");
var songTbl    = db.table("song");
var songTagTbl = db.table("song_tag");
Object.keys(artists).forEach(function(name) {
  var artist = artistTbl.ins({name: name});
  artists[name].forEach(function(song) {
    var song = songTbl.ins({ title: song[1], rate: song[0], artist: artist });
    songTagTbl.ins({song: song, tag_id : song.id * 2 });
    songTagTbl.ins({song: song, tag_id : song.id * 3 });
    songTagTbl.ins({song: song, tag_id : song.id * 5 });
  });
});


var st = JSON.stringify;

vows.describe('== TESTING IN/OUT ==').addBatch({
  "compression": {
    topic: db.table("song"),

    "data" : function(songTbl) {
      var compressed   = Table._compressData(songTbl._colInfos, songTbl._data, songTbl._indexes, songTbl._idxKeys);
      var decompressed = Table._decompressData(compressed)
      var recompressed = Table._compressData(decompressed[0], decompressed[1], decompressed[2], decompressed[3])
      var redecomp     = Table._decompressData(recompressed);
      assert.deepEqual(compressed, recompressed);

      // console.log(st(compressed));
      // console.log(st(decompressed));
      assert.deepEqual(songTbl._colInfos, decompressed[0])
      assert.deepEqual(songTbl._data, decompressed[1])
      assert.equal(st(songTbl._indexes), st(decompressed[2]))
      assert.equal(st(redecomp), st(decompressed))
    },

    "classes": function() {
      var tbl = db.table("tag");
      var classes = tbl._classes;
      var cClasses = Table._compressClasses(classes);
      var deClasses = Table._decompressClasses(cClasses);
      var recClasses = Table._compressClasses(deClasses);
      assert.deepEqual(classes, deClasses)
      assert.equal(st(classes),  st(deClasses));
      assert.deepEqual(cClasses, recClasses)
      assert.equal(st(cClasses), st(recClasses));
    },

    "rels": function() {
      var tbl = db.table("song");
      var rels = tbl._rels;
      var referreds  = tbl._referreds;;
      var cRelRefs = Table._compressRels(rels, referreds);
      var relRefs = Table._decompressRels(cRelRefs);
      assert.deepEqual([rels, referreds], relRefs)
    },

    "all": function() {
      var tbl = db.table("song");
      var c = tbl._compress();
      tbl._parseCompressed(c);
      assert.equal(st(tbl._compress()), st(c))
    },
  },

  "export/import": {
    topic: db,

    "import fails when uniqId is null" : function(v) {
      try { var newDB = JSRel.$import() }
      catch (e) {
        assert.match(e.message, /uniqId is required and must be non-zero value/);
      }
    },

    "cloning" : function(v) {
      var comp  = db.$export();
      var newDB = JSRel.$import("anotherId", comp);
      assert.equal(comp, newDB.$export());
    },

    "compression rate" : function(v) {
      var comp   = db.$export();
      var nocomp = db.$export(true);
      assert.isTrue(comp.length * 2 < nocomp.length)
    }
  }
}).export(module);