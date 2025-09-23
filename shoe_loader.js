const canvas = document.getElementById("shoe");
    const ctx = canvas.getContext("2d");

    const color = "#EBEBEB";
    const glow = "#5DE2E7";

    const outline = color; // dark navy (upper)
    const midsole = color; // gray midsole
    const outsole = color; // darker outsole

    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // === define shoe outline path ===
    const shoePath = new Path2D();
    shoePath.moveTo(50, 140);             // heel
    shoePath.lineTo(50, 90);              // up to ankle
    shoePath.quadraticCurveTo(100, 100, 120, 75); // upper curve
    shoePath.quadraticCurveTo(120, 75, 120, 75); // upper curve
    shoePath.quadraticCurveTo(170, 90, 200, 100); // upper curve
    shoePath.quadraticCurveTo(200, 100, 200, 100); // upper curve
    shoePath.quadraticCurveTo(230, 100, 230, 100); // upper curve
    shoePath.quadraticCurveTo(250, 110, 250, 140); // toe down
    shoePath.lineTo(50, 140); 

    // === define midsole ===
    const midsolePath = new Path2D();

    // === define outsole ===
    const outsolePath = new Path2D();
    outsolePath.moveTo(50, 150);
    outsolePath.quadraticCurveTo(50, 150, 250, 150); // slightly lower curve

    let offset = 0;
    function animate() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // outsole (thicker, dark)
      ctx.lineWidth = 6;
      ctx.strokeStyle = outsole;
      ctx.shadowBlur = 0;
      ctx.stroke(outsolePath);

      // midsole (slimmer, gray)
      ctx.lineWidth = 4;
      ctx.strokeStyle = midsole;
      ctx.stroke(midsolePath);

      // upper outline (static dark navy)
      ctx.lineWidth = 5;
      ctx.strokeStyle = outline;
      ctx.stroke(shoePath);

      // glowing tracer on upper outline
      ctx.setLineDash([40, 435]);
      ctx.lineDashOffset = -offset;
      ctx.strokeStyle = glow;
      ctx.shadowColor = glow;
      ctx.shadowBlur = 20;
      ctx.stroke(shoePath);

      ctx.setLineDash([]);
      offset += 4;
      requestAnimationFrame(animate);
    }

    animate();