(function () {
  'use strict';

  // ---------- Configurações ----------
  const SPEED_MAX = 55; // km/h
  const SPEED_MIN = 0;
  const WS_URL = `/ws`;

  // ---------- Elementos DOM ----------
  const speedCanvas = document.getElementById('speedCanvas');
  const directionCanvas = document.getElementById('directionCanvas');
  const speedValueEl = document.getElementById('speedValue');
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');
  const sensorSelect = document.getElementById('sensorSelect');

  // ---------- Contextos ----------
  const speedCtx = speedCanvas.getContext('2d');
  const directionCtx = directionCanvas.getContext('2d');

  // ---------- Estado dos medidores ----------
  let currentSpeed = 0;
  let currentDirection = 0;
  let targetSpeed = 0;
  let targetDirection = 0;
  let animationFrame = null;
  let resizeTimer = null;
  const RESIZE_DEBOUNCE_MS = 140;

  // ---------- Estado do WebSocket ----------
  let ws = null;
  let reconnectTimer = null;
  let reconnectAttempts = 0;
  const MAX_RECONNECT_ATTEMPTS = 10;
  const BASE_RECONNECT_DELAY = 2000;

  // ---------- Funções de desenho (mantidas) ----------
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

  function degreesToDirection(deg) {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const index = Math.round(((deg % 360) / 45)) % 8;
    return directions[index];
  }

  // ---------- Animação ----------
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
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      syncGaugeCanvasSizes();
      if (!animationFrame) animate();
      resizeTimer = null;
    }, RESIZE_DEBOUNCE_MS);
  }

  // ---------- Status da conexão ----------
  function setStatus(isConnected) {
    if (isConnected) {
      statusDot.className = 'status-dot connected';
      statusText.textContent = 'Conectado';
    } else {
      statusDot.className = 'status-dot disconnected';
      statusText.textContent = 'Desconectado';
    }
  }

  // ---------- Atualização dos dados via WebSocket ----------
  function updateData(data) {
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

  // ---------- Gerenciamento do WebSocket ----------
  function connectWebSocket() {
    if (ws && ws.readyState === WebSocket.OPEN) return;

    try {
      ws = new WebSocket(WS_URL);

      ws.onopen = function () {
        console.log('WebSocket conectado');
        setStatus(true);
        reconnectAttempts = 0;
        if (reconnectTimer) {
          clearTimeout(reconnectTimer);
          reconnectTimer = null;
        }
        // NÃO envia seleção automática — aguarda o usuário escolher
      };

      ws.onmessage = function (event) {
        try {
          const data = JSON.parse(event.data);
          if (data.wind_speed !== undefined || data.speed !== undefined) {
            updateData(data);
          } else {
            console.debug('Mensagem WS recebida:', data);
          }
        } catch (e) {
          console.error('Erro ao parsear dados do WS:', e);
        }
      };

      ws.onclose = function () {
        console.warn('WebSocket desconectado');
        setStatus(false);
        ws = null;
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttempts++;
          const delay = Math.min(BASE_RECONNECT_DELAY * Math.pow(2, reconnectAttempts), 30000);
          reconnectTimer = setTimeout(connectWebSocket, delay);
        } else {
          console.error('Número máximo de tentativas de reconexão WS atingido.');
        }
      };

      ws.onerror = function (err) {
        console.error('Erro no WebSocket:', err);
        ws.close();
      };

    } catch (e) {
      console.error('Falha ao criar WebSocket:', e);
      setStatus(false);
    }
  }

  // ---------- Carregar sensores via API ----------
  async function fetchSensors() {
    try {
      const response = await fetch('/api/sensors');
      if (!response.ok) throw new Error('Erro ao buscar sensores');
      const sensors = await response.json();

      // Limpa o select mantendo a opção placeholder
      sensorSelect.innerHTML = '';
      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = 'Selecione um sensor';
      placeholder.selected = true;
      placeholder.disabled = true;
      sensorSelect.appendChild(placeholder);

      if (!sensors || sensors.length === 0) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = 'Nenhum sensor disponível';
        opt.disabled = true;
        sensorSelect.appendChild(opt);
        return;
      }

      sensors.forEach(sensor => {
        const opt = document.createElement('option');
        opt.value = sensor.id;
        opt.textContent = `${sensor.name} (${sensor.city || 'Local'}) - ${sensor.connected ? '🟢 Online' : '🔴 Offline'}`;
        sensorSelect.appendChild(opt);
      });

      // NÃO seleciona automaticamente o primeiro sensor
      // O placeholder continua selecionado

    } catch (error) {
      console.error('Falha ao carregar sensores:', error);
      sensorSelect.innerHTML = '';
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'Erro ao carregar sensores';
      opt.disabled = true;
      opt.selected = true;
      sensorSelect.appendChild(opt);
    }
  }

  // ---------- Evento de mudança no select ----------
  sensorSelect.addEventListener('change', function () {
    const sensorId = this.value;
    if (!sensorId) {
      // Se o usuário selecionar o placeholder (vazio), não faz nada
      return;
    }
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ action: 'select_sensor', sensor_id: sensorId }));
    } else {
      console.warn('WebSocket não está aberto, a seleção será enviada quando reconectar.');
      // Opcional: tentar reconectar imediatamente
      if (!ws || ws.readyState === WebSocket.CLOSED) {
        connectWebSocket();
      }
    }
  });

  // ---------- Inicialização ----------
  setStatus(false);
  syncGaugeCanvasSizes();
  animate();
  window.addEventListener('resize', handleResize, { passive: true });

  // Carrega sensores e conecta WS (sem selecionar automaticamente)
  fetchSensors().then(() => {
    connectWebSocket();
  });

  window.addEventListener('beforeunload', function () {
    if (ws) {
      ws.close();
      ws = null;
    }
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (resizeTimer) clearTimeout(resizeTimer);
    if (animationFrame) cancelAnimationFrame(animationFrame);
  });

})();