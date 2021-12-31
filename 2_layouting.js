"use strict"

const fs = require('fs');

let nodes = JSON.parse(fs.readFileSync('data/links.json'));
let links = [];

let nodeLookup = new Map();
nodes.forEach((n,i) => {
	nodeLookup.set(cleanupHash(n.hash), n);
	n.xc = 1000*(((Math.cos(i*4831+6.86)+2.17)*9643) % 2 - 1);
	n.yc = 1000*(((Math.cos(i*7136+3.55)+5.45)*9445) % 2 - 1);
	n.offsetX = n.width/2;
	n.offsetY = n.height/2;
	n.size = n.hash.includes('rc3_21_lobby_main_json') ? 100 : 1;
})

nodes.forEach(n => {
	n.links = n.links.filter(l => {
		l.xc = l.x - n.offsetX;
		l.yc = l.y - n.offsetY;
		let hash = replaceHash(cleanupHash(l.hash));
		if (!hash) throw Error();
		l.node = nodeLookup.get(hash);
		return l.node;
	})
	n.links.forEach(l => {
		n.use = true;
		l.node.use = true;
	})
})
nodes = nodes.filter(n => n.use);


const n = 100;

console.log('\nstep 1/5');
process.stdout.write('   ');
for (let i = 0; i < n; i++) {
	process.stdout.write('.');
	for (let j = 0; j < 1000; j++) step(1,0);
}

console.log('\nstep 2/5');
process.stdout.write('   ');
for (let i = 0; i < n; i++) {
	process.stdout.write('.');
	for (let j = 0; j < 100; j++) step(1,1);
}

console.log('\nstep 3/5');
process.stdout.write('   ');
for (let i = 0; i < n; i++) {
	process.stdout.write('.');
	for (let j = 0; j < 100; j++) step(0.1,1);
}

nodes.forEach(n => n.size = 1);

console.log('\nstep 4/5');
process.stdout.write('   ');
for (let i = 0; i < n; i++) {
	process.stdout.write('.');
	for (let j = 0; j < 100; j++) step(0.01,1);
}

console.log('\nstep 5/5');
process.stdout.write('   ');
for (let i = 0; i < n; i++) {
	process.stdout.write('.');
	for (let j = 0; j < 100; j++) step(0,1);
}

exportVRT();
//exportSVG();

nodes.forEach(n => {
	n.links.forEach(l => {
		l.hash = l.node.hash;
		delete l.node;
	})
})

fs.writeFileSync('data/layout.json', JSON.stringify(nodes), 'utf8');

function exportVRT() {
	let x0 = 0;
	let y0 = 0;
	nodes.forEach(n => {
		x0 += n.xc;
		y0 += n.yc;
	});
	x0 /= nodes.length;
	y0 /= nodes.length;

	const size = 4096;
	const zoom = 32;

	let band1 = [];
	let band2 = [];
	let band3 = [];
	nodes.forEach(n => {
		let xi = Math.round(zoom*(n.xc - n.offsetX - x0 + size/2));
		let yi = Math.round(zoom*(n.yc - n.offsetY - y0 + size/2));
		let width  = Math.round(zoom*n.width);
		let height = Math.round(zoom*n.height);
		let file = n.slug+'.png';

		if (!fs.existsSync('image/'+file)) return;

		band1.push(`
			<SimpleSource>
				<SourceFilename relativeToVRT="1">${file}</SourceFilename>
				<SourceBand>1</SourceBand>
				<SourceProperties RasterYSize="${height}" DataType="Byte" BlockXSize="${width}" RasterXSize="${width}" BlockYSize="${height}"/>
				<SrcRect xOff="0" yOff="0" xSize="${width}" ySize="${height}"/>
				<DstRect xOff="${xi}" yOff="${yi}" xSize="${width}" ySize="${height}"/>
			</SimpleSource>`
		);
		band2.push(`
			<SimpleSource>
				<SourceFilename relativeToVRT="1">${file}</SourceFilename>
				<SourceBand>2</SourceBand>
				<SourceProperties RasterYSize="${height}" DataType="Byte" BlockXSize="${width}" RasterXSize="${width}" BlockYSize="${height}"/>
				<SrcRect xOff="0" yOff="0" xSize="${width}" ySize="${height}"/>
				<DstRect xOff="${xi}" yOff="${yi}" xSize="${width}" ySize="${height}"/>
			</SimpleSource>`
		);
		band3.push(`
			<SimpleSource>
				<SourceFilename relativeToVRT="1">${file}</SourceFilename>
				<SourceBand>3</SourceBand>
				<SourceProperties RasterYSize="${height}" DataType="Byte" BlockXSize="${width}" RasterXSize="${width}" BlockYSize="${height}"/>
				<SrcRect xOff="0" yOff="0" xSize="${width}" ySize="${height}"/>
				<DstRect xOff="${xi}" yOff="${yi}" xSize="${width}" ySize="${height}"/>
			</SimpleSource>`
		);
	})


	let vrt = (`
	<VRTDataset rasterXSize="${size*zoom}" rasterYSize="${size*zoom}">
		<SRS>PROJCS["WGS 84 / Pseudo-Mercator",GEOGCS["WGS 84",DATUM["WGS_1984",SPHEROID["WGS 84",6378137,298.257223563,AUTHORITY["EPSG","7030"]],AUTHORITY["EPSG","6326"]],PRIMEM["Greenwich",0,AUTHORITY["EPSG","8901"]],UNIT["degree",0.0174532925199433,AUTHORITY["EPSG","9122"]],AUTHORITY["EPSG","4326"]],PROJECTION["Mercator_1SP"],PARAMETER["central_meridian",0],PARAMETER["scale_factor",1],PARAMETER["false_easting",0],PARAMETER["false_northing",0],UNIT["metre",1,AUTHORITY["EPSG","9001"]],AXIS["Easting",EAST],AXIS["Northing",NORTH],EXTENSION["PROJ4","+proj=merc +a=6378137 +b=6378137 +lat_ts=0 +lon_0=0 +x_0=0 +y_0=0 +k=1 +units=m +nadgrids=@null +wktext +no_defs"],AUTHORITY["EPSG","3857"]]</SRS>
		<GeoTransform>0.000000, 1, 0, 0.000000, 0, -1</GeoTransform>
		<VRTRasterBand dataType="Byte" band="1">
			${band1.join('\n')}	
		</VRTRasterBand>
		<VRTRasterBand dataType="Byte" band="2">
			${band2.join('\n')}	
		</VRTRasterBand>
		<VRTRasterBand dataType="Byte" band="3">
			${band3.join('\n')}	
		</VRTRasterBand>
	</VRTDataset>`);
	fs.writeFileSync('image/map.vrt', vrt, 'utf8');
}

function exportSVG() {
	let x0 = 0;
	let y0 = 0;
	nodes.forEach(n => {
		x0 += n.xc;
		y0 += n.yc;
	});
	x0 /= nodes.length;
	y0 /= nodes.length;

	let size = 2048;
	let svg = [];
	svg.push('<?xml version="1.0" encoding="UTF-8" standalone="no"?>');
	svg.push('<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">');
	svg.push('<svg width="'+(2*size)+'" height="'+(2*size)+'" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">');
	svg.push('<rect x="-10" y="-10" width="'+(size*2+20)+'" height="'+(size*2+20)+'" fill="black"/>')
	nodes.forEach(n => {
		n.xi = Math.round(32*(n.xc - n.offsetX + size - x0))/32;
		n.yi = Math.round(32*(n.yc - n.offsetY + size - y0))/32;
		//svg.push('<rect x="'+n.xi+'" y="'+n.yi+'" width="'+n.width+'" height="'+n.height+'" stroke="#F00" fill="rgba(0,255,0,0.1)"/>');
		svg.push('<image x="'+n.xi+'" y="'+n.yi+'" width="'+n.width+'" height="'+n.height+'" xlink:href="image/'+n.slug+'.png"/>');
	})
	nodes.forEach(n1 => {
		n1.links.forEach(l => {
			let n2 = l.node;
			l.x1 = n1.xc + size - x0 + l.xc;
			l.y1 = n1.yc + size - y0 + l.yc;
			l.x2 = n2.xc + size - x0;
			l.y2 = n2.yc + size - y0;
			//svg.push('<line x1="'+l.x1+'" y1="'+l.y1+'" x2="'+l.x2+'" y2="'+l.y2+'" stroke="#fff" stroke-width="0.1" />')
		})
	})
	svg.push('</svg>');
	fs.writeFileSync('map.svg', svg.join('\n'), 'utf8');
}

function step(strengthLink = 0, strengthNodes = 1) {
	nodes.forEach(n => {
		n.fx = 0;
		n.fy = 0;
		n.fs = 0;
	})

	if (strengthLink > 0) {
		nodes.forEach(n1 => {
			n1.links.forEach(l => {
				let n2 = l.node;
				if (n1 === n2) return;

				let dx = n2.xc - (n1.xc + l.xc);
				let dy = n2.yc - (n1.yc + l.yc);

				let f = strengthLink*Math.sqrt(n1.size*n2.size);
				let f1 = f*n2.size/(n1.size + n2.size);
				let f2 = f*n1.size/(n1.size + n2.size);

				n1.fx += f1*dx; n1.fy += f1*dy; n1.fs += f;
				n2.fx -= f2*dx; n2.fy -= f2*dy; n2.fs += f;
			})
		})
	}

	if (strengthNodes > 0) {
		for (let i = 0; i < nodes.length; i++) {
			let n1 = nodes[i];
			for (let j = i+1; j < nodes.length; j++) {
				let n2 = nodes[j];

				let dx = n2.xc - n1.xc;
				let dy = n2.yc - n1.yc;

				let xMax = n1.offsetX + n2.offsetX + 1;
				let yMax = n1.offsetY + n2.offsetY + 1;

				let a = Math.max(Math.abs(dx/xMax), Math.abs(dy/yMax))

				if (a > 1) continue;

				dx = dx - dx / a;
				dy = dy - dy / a;

				let f = strengthNodes*Math.sqrt(n1.size*n2.size);
				let f1 = f*n2.size/(n1.size + n2.size);
				let f2 = f*n1.size/(n1.size + n2.size);

				n1.fx += f1*dx/2; n1.fy += f1*dy/2; n1.fs += f;
				n2.fx -= f2*dx/2; n2.fy -= f2*dy/2; n2.fs += f;
			}
		}
	}

	nodes.forEach(n => {
		if (n.fs === 0) return;
		n.xc += n.fx/n.fs;
		n.yc += n.fy/n.fs;
	})
}

function cleanupHash(hash) {
	return hash.replace(/_+/g,'_');
}

function replaceHash(hash) {
	return hash
	switch (hash) {
		case 'https_lobby_maps_at_rc3_world_maps_main_json': return 'https_lobby_maps_at_rc3_world_main_json';
		case 'https_lobby_maps_at_rc3_world_maps_foyer_json': return 'https_lobby_maps_at_rc3_world_main_json';
		case 'https_c-base-assembly_maps_at_rc3_world_main_json': return 'https_c-base_maps_at_rc3_world_main_json';
		case 'https_c3kidspace_maps_at_rc3_world_7B_3Clobby_3E_maps_erfas-spaces-north_json': return 'https_lobby_maps_at_rc3_world_maps_erfas-spaces-north_json';
		case 'https_chaosvermittlung_maps_at_rc3_world_22https_lobby_maps_at_rc3_world_maps_hardware-making_json': return 'https_lobby_maps_at_rc3_world_maps_hardware-making_json';
		case 'https_lobby_maps_at_rc3_world_erfas-spaces-north_json': return 'https_lobby_maps_at_rc3_world_maps_erfas-spaces-north_json';
		case 'https_lobby_maps_at_rc3_world_generic-assemblies_json': return 'https_lobby_maps_at_rc3_world_maps_generic-assemblies_json';
		case 'https_nullmusuem_maps_at_rc3_world_main_json': return 'https_nullmuseum_maps_at_rc3_world_main_json';
		case 'https_reality-adjustment_maps_at_rc3_world_map_json': return 'https_reality-adjustment_maps_at_rc3_world_main_json';
		case 'https_spielekiste_maps_at_rc3_world_GateArea_7B_3Clobby_3E_maps_erfas-spaces-north_json': return 'https_lobby_maps_at_rc3_world_maps_erfas-spaces-north_json';
		case 'https_team23_maps_at_rc3_world_lookout_json': return 'https_team23_maps_at_rc3_world_look-out_json';
		case 'https_whistleblowers-assembly_maps_at_rc3_world_main_json': return 'https_whistleblowers_maps_at_rc3_world_main_json';
		case 'https_angelkitchen_maps_at_rc3_world_main_json': return 'https_engelkittchen_maps_at_rc3_world_main_json';
		default: return hash;
	}
}


