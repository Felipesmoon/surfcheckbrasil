(function () {
  'use strict';

  // ---------- Configurações ----------
  const SPEED_MAX = 55; // km/h
  const SPEED_MIN = 0;
  const SENSORS_URL = '/api/sensors';
  const WS_PATH = '/ws';

  // ---------- Elementos DOM ----------
  const speedCanvas = document.getElementById('speedCanvas');
  const directionCanvas = document.getElementById('directionCanvas');
  const speedValueEl = document.getElementById('speedValue');
  const sensorSelect = document.getElementById('sensorSelect');

  // ---------- Contextos ----------
  const speedCtx = speedCanvas.getContext('2d');
  const directionCtx = directionCanvas.getContext('2d');

  // ---------- Estado atual dos medidores ----------
  let currentSpeed = 0;
  let currentDirection = 0;
  let targetSpeed = 0;
  let targetDirection = 0;
  let animationFrame = null;
  let resizeTimer = null;
  const RESIZE_DEBOUNCE_MS = 140;

  // ---------- Estado da conexão WebSocket ----------
  let ws = null;
  let reconnectTimer = null;
  let reconnectAttempts = 0;
  let isReconnecting = false;
  const MAX_RECONNECT_ATTEMPTS = 10;
  const BASE_RECONNECT_DELAY = 2000;   // 2s
  const MAX_RECONNECT_DELAY = 30000;   // 30s

  // ---------- Estado do sensor selecionado ----------
  let selectedSensorId = null;

  // ---------- Funções de desenho ----------
  function drawSpeedometer(ctx, value) {
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const radius = Math.min(w, h) * 0.38;

    ctx.clearRect(0, 0, w, h);

    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 6, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fill();
    ctx.shadowBlur = 0;

    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#1a2240');
    grad.addColorStop(1, '#2a3455');
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 2;
    ctx.stroke();

    const startAngle = -150 * Math.PI / 180;
    const endAngle = 150 * Math.PI / 180;
    const rangeAngle = endAngle - startAngle;

    const totalTicks = 20;
    for (let i = 0; i <= totalTicks; i++) {
      const frac = i / totalTicks;
      const angle = startAngle + frac * rangeAngle;
      const isMajor = (i % 5 === 0);
      const innerR = radius * (isMajor ? 0.82 : 0.88);
      const outerR = radius * 0.92;
      const x1 = cx + Math.cos(angle) * innerR;
      const y1 = cy + Math.sin(angle) * innerR;
      const x2 = cx + Math.cos(angle) * outerR;
      const y2 = cy + Math.sin(angle) * outerR;

      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = isMajor ? '#b0c4ff' : 'rgba(255,255,255,0.25)';
      ctx.lineWidth = isMajor ? 2.5 : 1.5;
      ctx.stroke();

      if (isMajor) {
        const val = Math.round(SPEED_MIN + frac * (SPEED_MAX - SPEED_MIN));
        const labelR = radius * 0.72;
        const lx = cx + Math.cos(angle) * labelR;
        const ly = cy + Math.sin(angle) * labelR;
        ctx.fillStyle = '#8892b0';
        ctx.font = '12px "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(val, lx, ly);
      }
    }

    const valueFrac = Math.min(Math.max((value - SPEED_MIN) / (SPEED_MAX - SPEED_MIN), 0), 1);
    const currentAngle = startAngle + valueFrac * rangeAngle;

    const hue = 120 - valueFrac * 120;
    const gradArc = ctx.createRadialGradient(cx - radius * 0.2, cy - radius * 0.2, 10, cx, cy, radius);
    gradArc.addColorStop(0, `hsl(${hue}, 90%, 65%)`);
    gradArc.addColorStop(1, `hsl(${hue}, 80%, 45%)`);

    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.82, startAngle, currentAngle);
    ctx.strokeStyle = gradArc;
    ctx.lineWidth = 12;
    ctx.lineCap = 'round';
    ctx.shadowColor = `hsla(${hue}, 80%, 50%, 0.4)`;
    ctx.shadowBlur = 15;
    ctx.stroke();
    ctx.shadowBlur = 0;

    const pointerLen = radius * 0.72;
    const pointerAngle = currentAngle;
    const px = cx + Math.cos(pointerAngle) * pointerLen;
    const py = cy + Math.sin(pointerAngle) * pointerLen;

    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(px, py);
    ctx.strokeStyle = '#f0f4ff';
    ctx.lineWidth = 3;
    ctx.shadowColor = 'rgba(255,255,255,0.2)';
    ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.shadowBlur = 0;

    const gradCenter = ctx.createRadialGradient(cx - 4, cy - 4, 2, cx, cy, 16);
    gradCenter.addColorStop(0, '#f0f4ff');
    gradCenter.addColorStop(1, '#6b7ba0');
    ctx.beginPath();
    ctx.arc(cx, cy, 12, 0, Math.PI * 2);
    ctx.fillStyle = gradCenter;
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = 15;
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  function drawCompass(ctx, degrees) {
    const w = ctx.canvas.width;
    const h = ctx.canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const radius = Math.min(w, h) * 0.38;

    ctx.clearRect(0, 0, w, h);

    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 6, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fill();
    ctx.shadowBlur = 0;

    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#1a2240');
    grad.addColorStop(1, '#2a3455');
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 2;
    ctx.stroke();

    const cardinals = [
      { label: 'N', angle: -90 },
      { label: 'NE', angle: -45 },
      { label: 'E', angle: 0 },
      { label: 'SE', angle: 45 },
      { label: 'S', angle: 90 },
      { label: 'SW', angle: 135 },
      { label: 'W', angle: 180 },
      { label: 'NW', angle: -135 }
    ];
    cardinals.forEach(({ label, angle }) => {
      const rad = angle * Math.PI / 180;
      const outerR = radius * 0.92;
      const innerR = radius * 0.82;
      const x1 = cx + Math.cos(rad) * innerR;
      const y1 = cy + Math.sin(rad) * innerR;
      const x2 = cx + Math.cos(rad) * outerR;
      const y2 = cy + Math.sin(rad) * outerR;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = '#b0c4ff';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      const labelR = radius * 0.72;
      const lx = cx + Math.cos(rad) * labelR;
      const ly = cy + Math.sin(rad) * labelR;
      ctx.fillStyle = '#f0f4ff';
      ctx.font = 'bold 14px "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, lx, ly);
    });

    for (let i = 0; i < 36; i++) {
      const angleDeg = i * 10;
      const rad = (angleDeg - 90) * Math.PI / 180;
      const isMajor = (i % 9 === 0);
      const innerR = radius * (isMajor ? 0.85 : 0.90);
      const outerR = radius * 0.92;
      const x1 = cx + Math.cos(rad) * innerR;
      const y1 = cy + Math.sin(rad) * innerR;
      const x2 = cx + Math.cos(rad) * outerR;
      const y2 = cy + Math.sin(rad) * outerR;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.strokeStyle = isMajor ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.15)';
      ctx.lineWidth = isMajor ? 2 : 1;
      ctx.stroke();
    }

    const arrowAngle = (degrees - 90) * Math.PI / 180;
    const arrowLen = radius * 0.70;

    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 15;

    const tipX = cx + Math.cos(arrowAngle) * arrowLen;
    const tipY = cy + Math.sin(arrowAngle) * arrowLen;
    const leftAngle = arrowAngle + 140 * Math.PI / 180;
    const rightAngle = arrowAngle - 140 * Math.PI / 180;
    const baseLen = 20;
    const leftX = tipX + Math.cos(leftAngle) * baseLen;
    const leftY = tipY + Math.sin(leftAngle) * baseLen;
    const rightX = tipX + Math.cos(rightAngle) * baseLen;
    const rightY = tipY + Math.sin(rightAngle) * baseLen;

    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(leftX, leftY);
    ctx.lineTo(rightX, rightY);
    ctx.closePath();
    const gradArrow = ctx.createLinearGradient(tipX - 20, tipY - 20, tipX + 20, tipY + 20);
    gradArrow.addColorStop(0, '#f87171');
    gradArrow.addColorStop(1, '#ef4444');
    ctx.fillStyle = gradArrow;
    ctx.shadowColor = 'rgba(239, 68, 68, 0.5)';
    ctx.shadowBlur = 20;
    ctx.fill();
    ctx.shadowBlur = 0;

    const gradCenter = ctx.createRadialGradient(cx - 4, cy - 4, 2, cx, cy, 14);
    gradCenter.addColorStop(0, '#f0f4ff');
    gradCenter.addColorStop(1, '#6b7ba0');
    ctx.beginPath();
    ctx.arc(cx, cy, 14, 0, Math.PI * 2);
    ctx.fillStyle = gradCenter;
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = 15;
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  // ---------- Função de animação ----------
  function animate() {
    const speedDiff = targetSpeed - currentSpeed;
    const dirDiff = targetDirection - currentDirection;
    if (Math.abs(speedDiff) < 0.1 && Math.abs(dirDiff) < 0.1) {
      currentSpeed = targetSpeed;
      currentDirection = targetDirection;
    } else {
      currentSpeed += speedDiff * 0.12;
      currentDirection += dirDiff * 0.12;
    }

    speedValueEl.textContent = currentSpeed.toFixed(1);
    drawSpeedometer(speedCtx, currentSpeed);
    drawCompass(directionCtx, currentDirection);

    animationFrame = requestAnimationFrame(animate);
  }

  function fitCanvasToDisplay(canvas) {
    if (!canvas) return false;
    const displayWidth = Math.max(1, Math.floor(canvas.clientWidth));
    const displayHeight = Math.max(1, Math.floor(canvas.clientHeight));
    if (canvas.width === displayWidth && canvas.height === displayHeight) {
      return false;
    }
    canvas.width = displayWidth;
    canvas.height = displayHeight;
    return true;
  }

  function syncGaugeCanvasSizes() {
    const speedChanged = fitCanvasToDisplay(speedCanvas);
    const directionChanged = fitCanvasToDisplay(directionCanvas);
    if (speedChanged || directionChanged) {
      drawSpeedometer(speedCtx, currentSpeed);
      drawCompass(directionCtx, currentDirection);
    }
  }

  function handleResize() {
    if (animationFrame) {
      cancelAnimationFrame(animationFrame);
      animationFrame = null;
    }
    if (resizeTimer) {
      clearTimeout(resizeTimer);
    }
    resizeTimer = setTimeout(() => {
      syncGaugeCanvasSizes();
      if (!animationFrame) {
        animate();
      }
      resizeTimer = null;
    }, RESIZE_DEBOUNCE_MS);
  }

  // ---------- Status da conexão ----------
  function setStatus(isConnected) {
    const dot = document.getElementById('statusDot');
    const text = document.getElementById('statusText');
    if (isConnected) {
      dot.className = 'status-dot connected';
      text.textContent = 'Conectado';
    } else {
      dot.className = 'status-dot disconnected';
      text.textContent = 'Desconectado';
    }
  }

  // ---------- Sensores ----------
  async function loadSensors() {
    try {
      const response = await fetch(SENSORS_URL);
      if (!response.ok) throw new Error(`Erro HTTP ${response.status}`);
      const sensors = await response.json();

      if (!sensorSelect) return;
      sensorSelect.innerHTML = '<option value="">Selecione uma estação...</option>';

      sensors.forEach((sensor) => {
        const option = document.createElement('option');
        option.value = sensor.id;
        const location = [sensor.city, sensor.province].filter(Boolean).join(', ');
        option.textContent = location ? `${sensor.name} — ${location}` : sensor.name;
        sensorSelect.appendChild(option);
      });

      // Seleciona automaticamente o primeiro sensor conectado, se houver
      const firstConnected = sensors.find((s) => s.connected);
      if (firstConnected) {
        sensorSelect.value = firstConnected.id;
        selectSensor(firstConnected.id);
      }
    } catch (error) {
      console.error('Erro ao carregar sensores:', error);
    }
  }

  function selectSensor(sensorId) {
    selectedSensorId = sensorId || null;
    if (!selectedSensorId) return;

    // Remove a opção de placeholder assim que uma estação é escolhida
    if (sensorSelect) {
      const placeholder = sensorSelect.querySelector('option[value=""]');
      if (placeholder) placeholder.remove();
    }

    sendWsMessage({ action: 'select_sensor', sensor_id: selectedSensorId });
  }

  if (sensorSelect) {
    sensorSelect.addEventListener('change', (event) => {
      selectSensor(event.target.value);
    });
  }

  // ---------- Atualização de dados via WebSocket ----------
  function updateData(data) {
    if (data.type === 'heartbeat') {
      setStatus(true);
      return;
    }

    let speed = parseFloat(data.wind_speed ?? data.speed);
    let direction = parseFloat(data.wind_direction ?? data.direction);

    if (isNaN(speed)) speed = 0;
    if (isNaN(direction)) direction = 0;

    speed = Math.min(Math.max(speed, SPEED_MIN), SPEED_MAX);
    direction = ((direction % 360) + 360) % 360;

    targetSpeed = speed;
    targetDirection = direction;

    setStatus(true);
  }

  // ---------- Gerenciamento da conexão WebSocket com reconexão automática ----------
  function sendWsMessage(payload) {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload));
    }
  }

  function scheduleReconnect() {
    if (isReconnecting) return;
    isReconnecting = true;

    if (ws) {
      ws.close();
      ws = null;
    }

    let delay = Math.min(BASE_RECONNECT_DELAY * Math.pow(2, reconnectAttempts), MAX_RECONNECT_DELAY);
    delay += Math.random() * 1000;

    console.log(`Tentativa de reconexão WebSocket #${reconnectAttempts + 1} em ${(delay / 1000).toFixed(1)}s`);

    reconnectTimer = setTimeout(() => {
      isReconnecting = false;
      connectWs();
    }, delay);
  }

  function connectWs() {
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${window.location.host}${WS_PATH}`;
    ws = new WebSocket(url);

    ws.onopen = function () {
      console.log('WebSocket conectado');
      setStatus(true);
      reconnectAttempts = 0;
      isReconnecting = false;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      if (selectedSensorId) {
        sendWsMessage({ action: 'select_sensor', sensor_id: selectedSensorId });
      }
    };

    ws.onmessage = function (event) {
      try {
        // O backend envia um envelope: {"event": "wind:<sensor_id>", "data": "<json string>"}
        // O campo "data" vem como string JSON (json.dumps aplicado duas vezes), então
        // é preciso um segundo JSON.parse para chegar aos campos de vento.
        const envelope = JSON.parse(event.data);
        const payload = typeof envelope.data === 'string'
          ? JSON.parse(envelope.data)
          : (envelope.data ?? envelope);
        updateData(payload);
      } catch (e) {
        console.error('Erro ao parsear dados:', e, event.data);
      }
    };

    ws.onerror = function (err) {
      console.error('Erro na conexão WebSocket:', err);
    };

    ws.onclose = function () {
      setStatus(false);
      if (MAX_RECONNECT_ATTEMPTS > 0 && reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        console.warn('Número máximo de tentativas de reconexão WebSocket atingido.');
        setStatus(false);
        return;
      }
      reconnectAttempts++;
      scheduleReconnect();
    };
  }

  // ---------- Inicialização ----------
  connectWs();
  loadSensors();

  syncGaugeCanvasSizes();
  animate();

  window.addEventListener('resize', handleResize, { passive: true });

  window.addEventListener('beforeunload', function () {
    if (ws) {
      ws.close();
      ws = null;
    }
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (resizeTimer) {
      clearTimeout(resizeTimer);
      resizeTimer = null;
    }
    if (animationFrame) {
      cancelAnimationFrame(animationFrame);
      animationFrame = null;
    }
  });

})();