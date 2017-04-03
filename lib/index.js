var fs = require('fs');
var url = require('url');
var glob = require('glob');
var path = require('path');

var walk = require('walk');
var toml = require('toml');
var minimist = require('minimist');
var matter = require('gray-matter');

var stripTags = require('striptags');
var stripMarkdown = require('remove-markdown');

var argv = minimist(process.argv.slice(2), {
  default: {
    i: 'content',
    o: 'public/lunr.json',
    extension: '.md'
  }
});

var hugoConfig;
fs.readFile('config.toml', 'utf8', function (err, data) {
  if (err) {
    return console.log('Can not find Hugo config: ' + err);
  }
  hugoConfig = toml.parse(data);
});

module.exports.index = function() {
  var output = [];
  var walker  = walk.walk(argv.i, {
    followLinks: false
  });

  walker.on('file', function(base, stat, next) {
    if (stat.name.indexOf(argv.extension) === -1) {
      return next();
    }

    var matter = readMatter(base + '/' + stat.name);
    var content = parseContentFile(matter);
    output.push(content);

    return next();
  });

  walker.on('end', function() {
    var stream = fs.createWriteStream(argv.o);
    stream.write(JSON.stringify(output, null, 2));
    stream.end();
  });
}

readMatter = file => {
  return matter.read(file, {
    delims: '+++',
    lang:'toml'
  });
}

stripWhitespace = content => {
  return content.replace(/[\s\n\\]+/g, ' ').trim();
}

stripHugoShortcodes = content => {
  return content.replace(/{{.*}}/g, '');
}

getUriFromMatter = matter => {
  var urlo = url.parse(hugoConfig.baseURL);
  var filePath = matter.path.replace(argv.i, '').replace(argv.extension, '');

  // Strip trailing slash from Hugo's default path.
  if (urlo.path.endsWith('/')) {
    urlo.path = urlo.path.slice(0, -1);
  }

  if (matter.data.slug) {
    filePath = path.dirname(filePath) + '/' + matter.data.slug;
  }

  if (filePath.endsWith('_index')) {
    urlo.path += filePath.replace('_index', '');
  } else if (hugoConfig.uglyURLs) {
    urlo.path += filePath + '.html';
  } else {
    urlo.path += filePath + '/';
  }

  return urlo.path;
}

parseContentFile = matter => {
  var content = matter.content;

  content = stripTags(content, [], ' ');
  content = stripMarkdown(content);
  content = stripHugoShortcodes(content);
  content = stripWhitespace(content);

  return {
    uri: getUriFromMatter(matter),
    title: matter.data.title,
    tags: matter.data.tags || [],
    content: content
  };
}
