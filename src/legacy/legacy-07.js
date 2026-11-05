
// Match the backdrop's native pixel to one physical display pixel, like the compact sprite art.
ww=1920;wh=1080;pixelGrid=1;pixelBox=function(x,y,w,h,c){let small=w<=4&&h<=5,k=small?1:3;rect(snap(x*3),snap(y*3),Math.max(1,snap(w*k)),Math.max(1,snap(h*k)),c)};pixelPoly=function(points,c){wctx.beginPath();wctx.moveTo(snap(points[0][0]*3),snap(points[0][1]*3));for(let i=1;i<points.length;i++)wctx.lineTo(snap(points[i][0]*3),snap(points[i][1]*3));wctx.closePath();wctx.fillStyle=c;wctx.fill()};
