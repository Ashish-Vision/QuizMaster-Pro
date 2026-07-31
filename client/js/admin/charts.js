"use strict";

(function initializeAdminCharts(globalObject) {
  const chartRegistry = new Map();

  function getCanvasContext(canvasId) {
    const canvas = document.getElementById(canvasId);

    if (!canvas) {
      return null;
    }

    const bounds = canvas.getBoundingClientRect();

    const pixelRatio = window.devicePixelRatio || 1;

    const width = Math.max(Math.floor(bounds.width), 300);

    const height = Math.max(Math.floor(bounds.height), 220);

    canvas.width = width * pixelRatio;
    canvas.height = height * pixelRatio;

    const context = canvas.getContext("2d");

    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

    return {
      canvas,
      context,
      width,
      height,
    };
  }

  function clearCanvas(chart) {
    chart.context.clearRect(0, 0, chart.width, chart.height);
  }

  function getCssVariable(name, fallback) {
    return (
      getComputedStyle(document.documentElement)
        .getPropertyValue(name)
        .trim() || fallback
    );
  }

  function drawEmptyState(chart, message) {
    clearCanvas(chart);

    chart.context.fillStyle = getCssVariable("--muted", "#96a7ba");

    chart.context.font = "14px system-ui, sans-serif";

    chart.context.textAlign = "center";

    chart.context.fillText(message, chart.width / 2, chart.height / 2);
  }

  function drawGrid(context, chartWidth, chartHeight, padding, maxValue) {
    const gridColor = "rgba(255, 255, 255, 0.08)";

    const textColor = getCssVariable("--muted", "#96a7ba");

    context.strokeStyle = gridColor;
    context.fillStyle = textColor;
    context.lineWidth = 1;
    context.font = "11px system-ui, sans-serif";
    context.textAlign = "right";

    const lineCount = 4;

    for (let index = 0; index <= lineCount; index += 1) {
      const ratio = index / lineCount;

      const y =
        padding.top + ratio * (chartHeight - padding.top - padding.bottom);

      const label = Math.round(maxValue * (1 - ratio));

      context.beginPath();

      context.moveTo(padding.left, y);

      context.lineTo(chartWidth - padding.right, y);

      context.stroke();

      context.fillText(String(label), padding.left - 10, y + 4);
    }
  }

  function drawLineChart(canvasId, labels, values, options = {}) {
    const chart = getCanvasContext(canvasId);

    if (!chart) {
      return;
    }

    chartRegistry.set(canvasId, {
      type: "line",
      labels,
      values,
      options,
    });

    const numericValues = values.map((value) =>
      Math.max(0, Number(value) || 0),
    );

    if (numericValues.every((value) => value === 0)) {
      drawEmptyState(chart, "No activity during this period.");

      return;
    }

    clearCanvas(chart);

    const padding = {
      top: 25,
      right: 20,
      bottom: 38,
      left: 44,
    };

    const maxValue = Math.max(...numericValues, 1);

    drawGrid(chart.context, chart.width, chart.height, padding, maxValue);

    const usableWidth = chart.width - padding.left - padding.right;

    const usableHeight = chart.height - padding.top - padding.bottom;

    const pointSpacing =
      numericValues.length > 1 ? usableWidth / (numericValues.length - 1) : 0;

    const points = numericValues.map((value, index) => ({
      x: padding.left + index * pointSpacing,

      y: padding.top + usableHeight - (value / maxValue) * usableHeight,

      value,
    }));

    const primaryColor =
      options.color || getCssVariable("--primary", "#7657ff");

    const gradient = chart.context.createLinearGradient(
      0,
      padding.top,
      0,
      chart.height - padding.bottom,
    );

    gradient.addColorStop(0, "rgba(118, 87, 255, 0.35)");

    gradient.addColorStop(1, "rgba(118, 87, 255, 0)");

    chart.context.beginPath();

    points.forEach((point, index) => {
      if (index === 0) {
        chart.context.moveTo(point.x, point.y);
      } else {
        chart.context.lineTo(point.x, point.y);
      }
    });

    chart.context.lineTo(
      points[points.length - 1].x,
      chart.height - padding.bottom,
    );

    chart.context.lineTo(points[0].x, chart.height - padding.bottom);

    chart.context.closePath();
    chart.context.fillStyle = gradient;
    chart.context.fill();

    chart.context.beginPath();

    points.forEach((point, index) => {
      if (index === 0) {
        chart.context.moveTo(point.x, point.y);
      } else {
        chart.context.lineTo(point.x, point.y);
      }
    });

    chart.context.strokeStyle = primaryColor;

    chart.context.lineWidth = 3;
    chart.context.lineJoin = "round";
    chart.context.lineCap = "round";
    chart.context.stroke();

    const textColor = getCssVariable("--muted", "#96a7ba");

    points.forEach((point, index) => {
      chart.context.beginPath();

      chart.context.arc(point.x, point.y, 4, 0, Math.PI * 2);

      chart.context.fillStyle = primaryColor;

      chart.context.fill();

      chart.context.font = "11px system-ui, sans-serif";

      chart.context.textAlign = "center";

      chart.context.fillStyle = textColor;

      chart.context.fillText(labels[index] || "", point.x, chart.height - 13);
    });
  }

  function drawBarChart(canvasId, labels, values, options = {}) {
    const chart = getCanvasContext(canvasId);

    if (!chart) {
      return;
    }

    chartRegistry.set(canvasId, {
      type: "bar",
      labels,
      values,
      options,
    });

    const numericValues = values.map((value) =>
      Math.max(0, Number(value) || 0),
    );

    if (numericValues.every((value) => value === 0)) {
      drawEmptyState(chart, "No data is available yet.");

      return;
    }

    clearCanvas(chart);

    const padding = {
      top: 24,
      right: 18,
      bottom: 54,
      left: 44,
    };

    const maxValue = Math.max(...numericValues, 1);

    drawGrid(chart.context, chart.width, chart.height, padding, maxValue);

    const usableWidth = chart.width - padding.left - padding.right;

    const usableHeight = chart.height - padding.top - padding.bottom;

    const groupWidth = usableWidth / numericValues.length;

    const barWidth = Math.min(groupWidth * 0.58, 55);

    const primaryColor =
      options.color || getCssVariable("--secondary", "#16c4df");

    numericValues.forEach((value, index) => {
      const barHeight = (value / maxValue) * usableHeight;

      const x = padding.left + index * groupWidth + (groupWidth - barWidth) / 2;

      const y = padding.top + usableHeight - barHeight;

      const gradient = chart.context.createLinearGradient(
        0,
        y,
        0,
        y + barHeight,
      );

      gradient.addColorStop(0, primaryColor);

      gradient.addColorStop(1, "rgba(118, 87, 255, 0.35)");

      chart.context.fillStyle = gradient;

      chart.context.beginPath();

      chart.context.roundRect(x, y, barWidth, Math.max(barHeight, 3), 7);

      chart.context.fill();

      chart.context.fillStyle = getCssVariable("--muted", "#96a7ba");

      chart.context.font = "10px system-ui, sans-serif";

      chart.context.textAlign = "center";

      const label = String(labels[index] || "");

      const shortenedLabel =
        label.length > 14 ? `${label.slice(0, 12)}…` : label;

      chart.context.fillText(
        shortenedLabel,
        x + barWidth / 2,
        chart.height - 17,
      );
    });
  }

  function redrawCharts() {
    chartRegistry.forEach((configuration, canvasId) => {
      if (configuration.type === "line") {
        drawLineChart(
          canvasId,
          configuration.labels,
          configuration.values,
          configuration.options,
        );
      }

      if (configuration.type === "bar") {
        drawBarChart(
          canvasId,
          configuration.labels,
          configuration.values,
          configuration.options,
        );
      }
    });
  }

  let resizeTimeout;

  window.addEventListener("resize", () => {
    clearTimeout(resizeTimeout);

    resizeTimeout = setTimeout(redrawCharts, 180);
  });

  globalObject.AdminCharts = {
    drawLineChart,
    drawBarChart,
    redrawCharts,
  };
})(window);
