#!/usr/bin/env node

"use strict"

const fs = require('fs');
const canvas = require('canvas');
const { resolve } = require('path');
const https = require('https');
const child_process = require('child_process');
const URL = require('url');
const {Image, createCanvas} = require('canvas');

const cacheFetch = new Cache(resolve(__dirname, 'cache'));

process.chdir(__dirname);
fs.mkdirSync('data', { recursive:true });
fs.mkdirSync('images', { recursive:true });

const FLIPPED_HORIZONTALLY_FLAG = 0x80000000;
const FLIPPED_VERTICALLY_FLAG   = 0x40000000;
const FLIPPED_DIAGONALLY_FLAG   = 0x20000000;

let links = [];
let queue = new Queue();
queue.add('https://visit.rc3.world/@/rc3_21/lobby/main.json');

run();

async function run() {
	while (!queue.empty()) {
		let roomUrl = queue.next();

		let metaData = await fetch(`https://exneuland.rc3.world/map?playUri=${encodeURIComponent(roomUrl)}`);
		if (!metaData) continue;

		let { mapUrl, roomSlug } = JSON.parse(metaData);
		roomSlug = hashUrl(roomSlug);
		let mapData = await fetch(mapUrl);
		if (!mapData) continue;

		mapData = mapData.toString('utf8');
		if (mapData.startsWith('<!doctype html>')) continue;

		try {
			mapData = JSON.parse(mapData);
		} catch (e) {
			console.log(mapData);
			console.log('SCRAPING PROBLEMS', e)
			continue;
		}

		scanForMapUrls(roomUrl, mapData, roomSlug);

		try {
			await generateScreenshot(mapUrl, mapData, roomSlug);
		} catch (e) {
			console.log('SCREENSHOT PROBLEMS', e)
			continue;
		}
	}

	fs.writeFileSync('data/links.json', JSON.stringify(links, null, '\t'), 'utf8');
}


function Queue() {
	let list = [];
	let set = new Set();

	return { add, empty, next }

	function add(url) {
		let key = url.toLowerCase().replace(/[^a-z0-9]/g,'');
		if (set.has(key)) return false;
		set.add(key);
		list.push(url);
		return true;
	}

	function empty() {
		return list.length === 0
	}

	function next() {
		return list.shift();
	}
}

function fetch(url) {
	let key = hashUrl(url);
	return cacheFetch(key, () => {

		//console.log('   fetch', url);
		return new Promise((resolve, reject) => {
			https.get(url, {timeout:10*1000}, res => {
				let buffers = [];
				res.on('data', chunk => {
					buffers.push(chunk)
				});
				if (res.statusCode !== 200) {
					console.log(url, res.statusCode, res.statusMessage);
					return reject();
				}
				res.on('error', err => {
					console.log('err', err);
					reject(err)
				})
				res.on('end', () => resolve(Buffer.concat(buffers)));
			}).on('error', err => {
				console.log('err', err);
				reject(err)
			})
		})
	})
}

function Cache(dir) {
	fs.mkdirSync(dir, {recursive:true});

	return async function (key, cb) {
		let filename = resolve(dir, key);
		if (fs.existsSync(filename)) return fs.promises.readFile(filename);
		try {
			let result = await cb();
			fs.writeFileSync(filename, result);
			return result;
		} catch (e) {
			//console.log('cache failed');
			return false;
		}
	}
}

async function generateScreenshot(baseUrl, data, slug) {
	let pngFilename = resolve(__dirname, 'images', slug+'.png');

	if (fs.existsSync(pngFilename)) return;
	if (data.infinite) return;

	console.log('   generateScreenshot', pngFilename);

	let tiles = [];

	//if (data.renderorder !== 'right-down') throw Error();
	if (data.tilewidth !== 32) throw Error();
	if (data.tileheight !== 32) throw Error();
	if (data.type !== 'map') throw Error();
	if (data.orientation !== 'orthogonal') throw Error();

	//console.log('   tileset');
	//console.dir(data, {depth:9});
	for (let tileset of data.tilesets) {
		//console.log(tileset.name);
		if (!tileset.tileheight) continue;
		if (!tileset.tilewidth) continue;
		if (tileset.backgroundcolor) {console.log(tileset); throw Error()};
		if (tileset.objectalignment) {console.log(tileset); throw Error()};
		if (tileset.tileoffset) {console.log(tileset); throw Error()};

		tileset.margin = tileset.margin || 0;
		tileset.spacing = tileset.spacing || 0;

		let image;
		if (tileset.image) {
			image = await loadImage(tileset.image);
			if (image) {
				if (tileset.transparentcolor) image = await makeColorTransparent(image, tileset.transparentcolor);

				for (let i = 0; i < tileset.tilecount; i++) {
					let x = tileset.margin + (tileset.spacing+tileset.tilewidth)*(i % tileset.columns);
					let y = tileset.margin + (tileset.spacing+tileset.tileheight)*(Math.floor(i/tileset.columns));
					tiles[i+tileset.firstgid] = { image, x, y, w:tileset.tilewidth, h:tileset.tileheight };
				}
			}
		}

		//console.log('tileset.tiles');

		if (!tileset.tiles) continue;

		for (let t of tileset.tiles) {
			if (t.animation && t.animation[0].tileid) {
				tiles[t.id+tileset.firstgid] = tiles[t.animation[0].tileid+tileset.firstgid]
				continue;
			}

			if (!t.image) {
				if (image) {
					let x = tileset.margin + (tileset.spacing+tileset.tilewidth)*(t.id % tileset.columns);
					let y = tileset.margin + (tileset.spacing+tileset.tileheight)*(Math.floor(t.id/tileset.columns));
					tiles[t.id+tileset.firstgid] = { image, x, y, w:tileset.tilewidth, h:tileset.tileheight };
				}
				continue;
			}

			if (!t.imageheight || !t.imagewidth) throw Error();

			let image2 = await loadImage(t.image);
			if (!image2) continue;
			if (tileset.transparentcolor) image2 = await makeColorTransparent(image2, tileset.transparentcolor);

			tiles[t.id+tileset.firstgid] = {
				image:image2,
				x:0,
				y:0,
				w:t.imagewidth,
				h:t.imageheight
			}
		}
	}

	async function makeColorTransparent(image, color) {
		if (color.length !== 7) throw Error();
		if (color[0] !== '#') throw Error();
		color = [
			parseInt(color.slice(1,3), 16),
			parseInt(color.slice(3,5), 16),
			parseInt(color.slice(5,7), 16),
		]

		let width = image.width;
		let height = image.height;
		let canvas2 = createCanvas(width, height);
		let ctx2 = canvas2.getContext('2d');
		ctx2.drawImage(image, 0, 0);
		let imageData = ctx2.getImageData(0,0,width,height);
		let data = imageData.data;
		for (let i = 0; i < data.length; i += 4) {
			if (data[i+0] !== color[0]) continue;
			if (data[i+1] !== color[1]) continue;
			if (data[i+2] !== color[2]) continue;
			data[i + 3] = 0;
		}
		ctx2.putImageData(imageData, 0, 0);

		return canvas2;
	}

	function loadImage(url) {
		if (!url) return new Promise(r => r(false));

		url = URL.resolve(baseUrl, url);
		url = url.replace(/#.*/,'');
		return new Promise((cbResolve, cbReject) => {
			const img = new Image();
			img.onload = () => cbResolve(img);
			img.onerror = err => cbReject(err);
			fetch(url).catch(e => cbResolve(false)).then(buffer => {
				if (!buffer) return cbResolve(false);
				img.src = buffer
			});
		})
	}

	let layerData = [];
	let visibleLayers = data.layers;
	visibleLayers = visibleLayers.filter(l => {
		if (l.type !== 'group') return true;
		l.layers.forEach(l => visibleLayers.push(l));
		return false;
	})
	visibleLayers = visibleLayers.filter(l => {
		if (!l.visible) return false;
		if (l.opacity === 0) return false;
		if (l.type === 'objectgroup') return false;
		if (l.type === 'imagelayer') return false; // sorry

		if (l.type !== 'tilelayer') error('l.type !== "tilelayer"');
		if (l.height !== data.height) error('l.height !== data.height');
		if (l.width !== data.width) error('l.width !== data.width');
		if (l.x !== 0) error('l.x !== 0');
		if (l.y !== 0) error('l.y !== 0');
		if (!l.data) error('!l.data');
		if (l.chunks) error('l.chunks');

		return true;

		function error(msg) {
			console.log('l',l);
			console.log('data',data);
			throw Error(msg);
		}
	})

	let canvas = createCanvas(data.width*32, data.height*32);
	let ctx = canvas.getContext('2d', {alpha: true});

	if (data.backgroundcolor) {
		ctx.fillStyle = data.backgroundcolor;
		ctx.fillRect(0, 0, data.width*32, data.height*32)
	} else {
		ctx.clearRect(0, 0, data.width*32, data.height*32)
	}

	for (let y0 = 0; y0 < data.height; y0++) {
		for (let x0 = 0; x0 < data.width; x0++) {
			let index = x0 + y0*data.width;

			visibleLayers.forEach(l => {
				let tileIndex = l.data[index];
				if (!tileIndex) return;

				// Read out the flags
				let flipped_horizontally = Boolean(tileIndex & FLIPPED_HORIZONTALLY_FLAG);
				let flipped_vertically   = Boolean(tileIndex & FLIPPED_VERTICALLY_FLAG);
				let flipped_diagonally   = Boolean(tileIndex & FLIPPED_DIAGONALLY_FLAG);

				let rotation = 0;
				let flipped = false;

				if (flipped_horizontally) {
					if (flipped_vertically) {
						if (flipped_diagonally) {
							rotation = Math.PI / 2;
							flipped = true;
						} else {
							rotation = Math.PI;
							flipped = false;
						}
					} else {
						if (flipped_diagonally) {
							rotation = Math.PI / 2;
							flipped = false;
						} else {
							rotation = 0;
							flipped = true;
						}
					}
				} else {
					if (flipped_vertically) {
						if (flipped_diagonally) {
							rotation = 3 * Math.PI / 2;
							flipped = false;
						} else {
							rotation = Math.PI;
							flipped = true;
						}
					} else {
						if (flipped_diagonally) {
							rotation = 3 * Math.PI / 2;
							flipped = true;
						} else {
							rotation = 0;
							flipped = false;
						}
					}
				}

				// Clear the flags
				tileIndex &= ~(FLIPPED_HORIZONTALLY_FLAG | FLIPPED_VERTICALLY_FLAG | FLIPPED_DIAGONALLY_FLAG);

				let tile = tiles[tileIndex];
				if (!tile) return;
				if (!tile.image) return;

				ctx.save();

				let halfWidth = tile.w / 2;
				let halfHeight = tile.h / 2;

				ctx.translate(x0*32 + halfWidth, y0*32 + halfHeight);

				let h_scale = flipped ? -1 : 1;

				ctx.scale(h_scale,1);
				ctx.rotate(rotation);

				ctx.globalAlpha = l.opacity;
				ctx.drawImage(tile.image, tile.x, tile.y, tile.w, tile.h, -halfWidth, -halfHeight, tile.w, tile.h);
				ctx.restore();
			})
		}
	}

	fs.writeFileSync(pngFilename, canvas.toBuffer('image/png'));

	child_process.execSync('optipng -nc '+pngFilename, {stdio:'ignore'});

	return
}

function scanForMapUrls(baseUrl, data, slug) {
	let mapLinks = [];
	data.layers.forEach(l => {
		if (!l) return;
		if (!l.properties) return;
		l.properties.forEach(p => {
			switch (p.name.toLowerCase()) {
				case 'audioloop':
				case 'audiovolume':
				case 'collide':
				case 'collides':
				case 'collision':
				case 'depth':
				case 'exitlayer':
				case 'getbadge':
				case 'getbadge_x':
				case 'jitsi':
				case 'jitsiinstance':
				case 'jitsiroom':
				case 'jitsiroomadmintag':
				case 'jitsiroomvizmain1':
				case 'jitsitrigger':
				case 'loop':
				case 'openaudio':
				case 'openwebsite':
				case 'playaudio':
				case 'playaudioloop':
				case 'silent':
				case 'start':
				case 'start_layer':
				case 'startlayer':
				case 'stew.one':
				case 'wilkommen':
				case 'xjitsitrigger':
				case 'xopenwebsitetrigger':

				return;
				case 'exiturl':
				case 'exitsceneurl':
					if ((l.x !== 0) || (l.y !== 0)) {
						console.log(l);
						//throw Error();
					}

					let url = URL.resolve(baseUrl, p.value);
					url = url.replace(/#.*/,'');
					//console.log(baseUrl, p.value, url);

					queue.add(url);

					if (l.data) {
						let xs = 0, ys = 0, s = 0;
						l.data.forEach((c,i) => {
							if (!c) return;
							let x = (i % l.width);
							let y = Math.floor(i/l.width);
							xs += x; ys += y; s++;
						})
						if (s > 0) mapLinks.push({url,hash:hashUrl(url),x:xs/s,y:ys/s});
					}

					if (l.chunks) {
						l.chunks.forEach(chunk => {
							let xs = 0, ys = 0, s = 0;
							chunk.data.forEach((c,i) => {
								if (!c) return;
								let x = chunk.x + (i % chunk.width);
								let y = chunk.y + Math.floor(i/chunk.width);
								xs += x; ys += y; s++;
							})
							if (s > 0) mapLinks.push({url,hash:hashUrl(url),x:xs/s,y:ys/s});
						})
					}
				break;
				default:
					//console.log('unknown tag', p.name);
			}
		})
	})
	links.push({
		width:data.width,
		height:data.height,
		url:baseUrl,
		hash:hashUrl(baseUrl),
		slug:slug,
		links:mapLinks,
	})
}

function hashUrl(url) {
	return url.replace(/[^a-z0-9_\-]/gi, '_');
}



