// 获取DOM元素
const video = document.getElementById('video');
const canvas = document.getElementById('drawingCanvas');
const ctx = canvas.getContext('2d');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const clearBtn = document.getElementById('clearBtn');
const colorPicker = document.getElementById('colorPicker');
const brushSize = document.getElementById('brushSize');

// 获取新添加的元素
const captureBtn = document.getElementById('captureBtn');
const styleSelect = document.getElementById('styleSelect');
const convertBtn = document.getElementById('convertBtn');
const resultCanvas = document.getElementById('resultCanvas');
const resultCtx = resultCanvas.getContext('2d');

// 变量初始化
let isDrawing = false;
let lastX = 0;
let lastY = 0;
let currentColor = colorPicker.value;
let currentSize = brushSize.value;
let faceLandmarks = null;
let isModelLoaded = false;
let animationId = null;
let isVideoStarted = false;
let capturedImage = null;

// 设置Canvas尺寸
function setCanvasSize() {
    // 确保视频元素已加载
    if (!video) {
        console.error('未找到视频元素');
        return;
    }

    // 等待视频元数据加载完成
    if (video.videoWidth === 0 || video.videoHeight === 0) {
        setTimeout(setCanvasSize, 100);
        return;
    }

    // 获取视频实际显示尺寸
    const videoRect = video.getBoundingClientRect();
    console.log('视频显示尺寸:', videoRect.width, 'x', videoRect.height);

    // 设置主Canvas尺寸与视频原始尺寸相同
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    console.log('Canvas原始尺寸:', video.videoWidth, 'x', video.videoHeight);

    // 设置主Canvas CSS尺寸以匹配视频显示尺寸
    canvas.style.width = `${videoRect.width}px`;
    canvas.style.height = `${videoRect.height}px`;
    console.log('Canvas显示尺寸:', canvas.style.width, 'x', canvas.style.height);

    // 设置结果Canvas尺寸
    resultCanvas.width = video.videoWidth;
    resultCanvas.height = video.videoHeight;
    // 右侧面板宽度约为主面板的35%
    resultCanvas.style.width = `${videoRect.width * 0.35}px`;
    resultCanvas.style.height = `${videoRect.height * 0.7}px`;
    console.log('ResultCanvas显示尺寸:', resultCanvas.style.width, 'x', resultCanvas.style.height);

    // 存储比例因子用于坐标转换
    window.canvasScaleX = video.videoWidth / videoRect.width;
    window.canvasScaleY = video.videoHeight / videoRect.height;
    console.log('Canvas比例因子:', window.canvasScaleX, window.canvasScaleY);
}

// 启动摄像头
async function startVideo() {
    try {
        console.log('尝试访问摄像头...');

        // 确保视频元素已准备好
        if (!video) {
            console.error('未找到视频元素');
            alert('视频元素加载失败，请刷新页面重试。');
            return;
        }

        // 获取可用摄像头设备
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        console.log('找到的摄像头设备数量:', videoDevices.length);
        videoDevices.forEach((device, index) => {
            console.log(`摄像头 ${index + 1}:`, device.label);
        });

        // 配置视频约束
        const constraints = {
            video: {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                facingMode: 'user', // 使用前置摄像头
                frameRate: { ideal: 30 }
            }
        };

        console.log('请求摄像头权限...');
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        console.log('成功获取摄像头流:', stream);

        // 绑定流到视频元素
        video.srcObject = stream;
        console.log('视频流已绑定到元素');

        // 额外的视频事件监听
        video.onloadeddata = () => {
            console.log('视频数据已加载');
        };

        video.onplay = () => {
            console.log('视频开始播放');
        };

        video.onerror = (error) => {
            console.error('视频播放错误:', error);
        };

        isVideoStarted = true;
        startBtn.disabled = true;
        stopBtn.disabled = false;
        clearBtn.disabled = false;
        captureBtn.disabled = false;
        setCanvasSize();

        // 显示摄像头启动成功信息
        const statusElement = document.createElement('div');
        statusElement.id = 'cameraStatus';
        statusElement.style.position = 'absolute';
        statusElement.style.top = '10px';
        statusElement.style.right = '10px';
        statusElement.style.backgroundColor = 'rgba(0,0,0,0.7)';
        statusElement.style.color = 'white';
        statusElement.style.padding = '5px 10px';
        statusElement.style.borderRadius = '5px';
        statusElement.textContent = '摄像头已启动';
        document.body.appendChild(statusElement);
        setTimeout(() => {
            statusElement.remove();
        }, 3000);

        // 等待视频加载完成后开始检测
        video.onloadedmetadata = () => {
            setCanvasSize();
            console.log('视频元数据已加载，分辨率:', video.videoWidth, 'x', video.videoHeight);
            
            // 确保视频元素有正确的尺寸
            if (video.videoWidth === 0 || video.videoHeight === 0) {
                console.warn('视频尺寸为0，尝试重置尺寸...');
                setTimeout(setCanvasSize, 1000);
            }

            if (isModelLoaded) {
                detectFaces();
            } else {
                console.log('模型尚未加载，等待模型加载完成后开始检测');
            }
        };
    } catch (error) {
        console.error('访问摄像头失败:', error);
        let errorMessage = '无法访问摄像头，请确保您已授予摄像头权限。';
        if (error.name === 'NotAllowedError') {
            errorMessage = '摄像头访问被拒绝，请在浏览器设置中启用摄像头权限。';
        } else if (error.name === 'NotFoundError') {
            errorMessage = '未找到摄像头设备，请确保您的设备已连接摄像头。';
        } else if (error.name === 'NotReadableError') {
            errorMessage = '摄像头被占用，请关闭其他使用摄像头的应用程序。';
        }
        alert(errorMessage + '\n错误详情: ' + error.message);
    }
}

// 停止摄像头
function stopVideo() {
    if (video.srcObject) {
        video.srcObject.getTracks().forEach(track => track.stop());
        video.srcObject = null;
        isVideoStarted = false;
        startBtn.disabled = false;
        stopBtn.disabled = true;
        clearBtn.disabled = true;
        // 停止动画帧
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }
        // 清除画布
        clearCanvas();
    }
}

// 清除画布
function clearCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

// 拍照功能
function captureImage() {
    if (!isVideoStarted) return;

    // 创建一个临时画布来绘制视频帧和涂鸦
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;

    // 绘制视频帧
    tempCtx.drawImage(video, 0, 0, canvas.width, canvas.height);
    // 绘制涂鸦（从主画布复制）
    tempCtx.drawImage(canvas, 0, 0);

    // 保存捕获的图像
    capturedImage = tempCanvas.toDataURL('image/png');

    // 在结果画布上显示捕获的图像
    const img = new Image();
    img.onload = function() {
        resultCtx.clearRect(0, 0, resultCanvas.width, resultCanvas.height);
        resultCtx.drawImage(img, 0, 0, resultCanvas.width, resultCanvas.height);
    };
    img.src = capturedImage;

    // 启用风格选择和转换按钮
    styleSelect.disabled = false;
    convertBtn.disabled = false;
}

// 高清修复功能
function enhanceImage(img) {
    // 创建临时画布进行处理
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    tempCanvas.width = img.width;
    tempCanvas.height = img.height;

    // 绘制原图
    tempCtx.drawImage(img, 0, 0);

    // 1. 应用高斯模糊降噪
    tempCtx.filter = 'blur(0.8px)';
    tempCtx.drawImage(tempCanvas, 0, 0);
    tempCtx.filter = 'none';

    // 2. 锐化处理
    const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;

    // 创建锐化核
    const sharpenKernel = [
        0, -1, 0,
        -1, 5, -1,
        0, -1, 0
    ];

    // 创建临时数据存储
    const tempData = new Uint8ClampedArray(data.length);

    // 应用锐化滤镜
    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            for (let c = 0; c < 3; c++) {
                let sum = 0;
                for (let ky = -1; ky <= 1; ky++) {
                    for (let kx = -1; kx <= 1; kx++) {
                        const pixelIndex = ((y + ky) * width + (x + kx)) * 4 + c;
                        const kernelIndex = (ky + 1) * 3 + (kx + 1);
                        sum += data[pixelIndex] * sharpenKernel[kernelIndex];
                    }
                }
                tempData[((y) * width + (x)) * 4 + c] = Math.min(Math.max(sum, 0), 255);
            }
            // 保留原始Alpha通道
            tempData[((y) * width + (x)) * 4 + 3] = data[((y) * width + (x)) * 4 + 3];
        }
    }

    // 将处理后的数据放回图像
    tempCtx.putImageData(new ImageData(tempData, width, height), 0, 0);

    // 3. 增加对比度
    tempCtx.filter = 'contrast(110%)';
    tempCtx.drawImage(tempCanvas, 0, 0);
    tempCtx.filter = 'none';

    return tempCanvas;
}

// 风格转换功能
function convertStyle() {
    if (!capturedImage) return;

    const style = styleSelect.value;

    // 创建图像对象来处理
    const img = new Image();
    img.onload = function() {
        // 清除结果画布
        resultCtx.clearRect(0, 0, resultCanvas.width, resultCanvas.height);

        // 先进行高清修复
        const enhancedCanvas = enhanceImage(img);

        // 应用不同的风格效果
        if (style === 'original') {
            // 原图
            resultCtx.drawImage(enhancedCanvas, 0, 0, resultCanvas.width, resultCanvas.height);
        } else if (style === 'anime') {
            // 动漫风格
            applyAnimeStyle(enhancedCanvas);
        } else if (style === 'oil') {
            // 油画风格
            applyOilStyle(enhancedCanvas);
        } else if (style === 'comic') {
            // 二次元风格
            applyComicStyle(enhancedCanvas);
        }
    };
    img.src = capturedImage;
}

// 动漫风格处理
function applyAnimeStyle(enhancedCanvas) {
    // 创建临时画布进行处理
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    tempCanvas.width = enhancedCanvas.width;
    tempCanvas.height = enhancedCanvas.height;

    // 绘制增强后的图像
    tempCtx.drawImage(enhancedCanvas, 0, 0);

    // 获取图像数据
    const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
    const data = imageData.data;

    // 1. 边缘检测
    const edgeData = new Uint8ClampedArray(data.length);
    const width = imageData.width;
    const height = imageData.height;
    const edgeThreshold = 20;

    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            for (let c = 0; c < 3; c++) {
                // Sobel算子边缘检测
                const gx = data[((y-1)*width + (x+1))*4 + c] + 2*data[(y*width + (x+1))*4 + c] + data[((y+1)*width + (x+1))*4 + c] -
                           data[((y-1)*width + (x-1))*4 + c] - 2*data[(y*width + (x-1))*4 + c] - data[((y+1)*width + (x-1))*4 + c];
                const gy = data[((y+1)*width + (x-1))*4 + c] + 2*data[((y+1)*width + x)*4 + c] + data[((y+1)*width + (x+1))*4 + c] -
                           data[((y-1)*width + (x-1))*4 + c] - 2*data[((y-1)*width + x)*4 + c] - data[((y-1)*width + (x+1))*4 + c];
                const gradient = Math.sqrt(gx*gx + gy*gy);
                edgeData[(y*width + x)*4 + c] = gradient > edgeThreshold ? 0 : data[(y*width + x)*4 + c];
            }
            edgeData[(y*width + x)*4 + 3] = data[(y*width + x)*4 + 3];
        }
    }

    // 2. 颜色风格化 - 减少色阶并提高饱和度
    for (let i = 0; i < data.length; i += 4) {
        const r = edgeData[i];
        const g = edgeData[i + 1];
        const b = edgeData[i + 2];

        // 转换为HSV
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let h, s, v = max / 255;
        const delta = max - min;

        s = max === 0 ? 0 : delta / max;

        if (max === min) {
            h = 0; // 灰度
        } else if (max === r) {
            h = ((g - b) / delta) % 6;
        } else if (max === g) {
            h = (b - r) / delta + 2;
        } else {
            h = (r - g) / delta + 4;
        }

        h = Math.round(h * 60);
        if (h < 0) h += 360;

        // 提高饱和度
        s = Math.min(s * 1.5, 1);

        // 转回RGB
        let newR, newG, newB;

        const c = v * s;
        const x = c * (1 - Math.abs((h / 60) % 2 - 1));
        const m = v - c;

        if (h >= 0 && h < 60) {
            newR = c; newG = x; newB = 0;
        } else if (h >= 60 && h < 120) {
            newR = x; newG = c; newB = 0;
        } else if (h >= 120 && h < 180) {
            newR = 0; newG = c; newB = x;
        } else if (h >= 180 && h < 240) {
            newR = 0; newG = x; newB = c;
        } else if (h >= 240 && h < 300) {
            newR = x; newG = 0; newB = c;
        } else {
            newR = c; newG = 0; newB = x;
        }

        newR = Math.round((newR + m) * 255);
        newG = Math.round((newG + m) * 255);
        newB = Math.round((newB + m) * 255);

        // 减少色阶
        newR = Math.round(newR / 32) * 32;
        newG = Math.round(newG / 32) * 32;
        newB = Math.round(newB / 32) * 32;

        data[i] = newR;
        data[i + 1] = newG;
        data[i + 2] = newB;
    }

    // 绘制处理后的图像
    tempCtx.putImageData(imageData, 0, 0);

    // 3. 应用轻微的发光效果增强动漫感
    tempCtx.filter = 'drop-shadow(0 0 2px rgba(255,255,255,0.6))';
    tempCtx.drawImage(tempCanvas, 0, 0);
    tempCtx.filter = 'none';

    // 绘制到结果画布
    resultCtx.drawImage(tempCanvas, 0, 0, resultCanvas.width, resultCanvas.height);
}

// 油画风格处理
function applyOilStyle(enhancedCanvas) {
    // 创建临时画布进行处理
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    tempCanvas.width = enhancedCanvas.width;
    tempCanvas.height = enhancedCanvas.height;

    // 绘制增强后的图像
    tempCtx.drawImage(enhancedCanvas, 0, 0);

    // 1. 应用纹理保留模糊
    const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    const tempData = new Uint8ClampedArray(data.length);
    const kernelSize = 5;
    const kernelRadius = Math.floor(kernelSize / 2);

    // 自定义模糊核 - 保留边缘的模糊
    for (let y = kernelRadius; y < height - kernelRadius; y++) {
        for (let x = kernelRadius; x < width - kernelRadius; x++) {
            for (let c = 0; c < 3; c++) {
                let sum = 0;
                let weightSum = 0;
                const centerValue = data[(y * width + x) * 4 + c];

                for (let ky = -kernelRadius; ky <= kernelRadius; ky++) {
                    for (let kx = -kernelRadius; kx <= kernelRadius; kx++) {
                        const pixelValue = data[((y + ky) * width + (x + kx)) * 4 + c];
                        // 基于像素差异的权重
                        const weight = 1 / (1 + Math.abs(pixelValue - centerValue) / 10);
                        sum += pixelValue * weight;
                        weightSum += weight;
                    }
                }

                tempData[(y * width + x) * 4 + c] = Math.round(sum / weightSum);
            }
            tempData[(y * width + x) * 4 + 3] = data[(y * width + x) * 4 + 3];
        }
    }

    // 2. 调整颜色和饱和度
    for (let i = 0; i < data.length; i += 4) {
        const r = tempData[i];
        const g = tempData[i + 1];
        const b = tempData[i + 2];

        // 转换为HSV
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let h, s, v = max / 255;
        const delta = max - min;

        s = max === 0 ? 0 : delta / max;

        if (max === min) {
            h = 0; // 灰度
        } else if (max === r) {
            h = ((g - b) / delta) % 6;
        } else if (max === g) {
            h = (b - r) / delta + 2;
        } else {
            h = (r - g) / delta + 4;
        }

        h = Math.round(h * 60);
        if (h < 0) h += 360;

        // 调整饱和度和明度
        s = Math.min(s * 1.2, 1);
        v = Math.min(v * 1.1, 1);

        // 转回RGB
        let newR, newG, newB;

        const c = v * s;
        const x = c * (1 - Math.abs((h / 60) % 2 - 1));
        const m = v - c;

        if (h >= 0 && h < 60) {
            newR = c; newG = x; newB = 0;
        } else if (h >= 60 && h < 120) {
            newR = x; newG = c; newB = 0;
        } else if (h >= 120 && h < 180) {
            newR = 0; newG = c; newB = x;
        } else if (h >= 180 && h < 240) {
            newR = 0; newG = x; newB = c;
        } else if (h >= 240 && h < 300) {
            newR = x; newG = 0; newB = c;
        } else {
            newR = c; newG = 0; newB = x;
        }

        newR = Math.round((newR + m) * 255);
        newG = Math.round((newG + m) * 255);
        newB = Math.round((newB + m) * 255);

        data[i] = newR;
        data[i + 1] = newG;
        data[i + 2] = newB;
    }

    // 3. 应用画布纹理效果
    tempCtx.putImageData(imageData, 0, 0);

    // 创建纹理画布
    const textureCanvas = document.createElement('canvas');
    const textureCtx = textureCanvas.getContext('2d');
    textureCanvas.width = tempCanvas.width;
    textureCanvas.height = tempCanvas.height;

    // 生成噪点纹理
    for (let y = 0; y < textureCanvas.height; y++) {
        for (let x = 0; x < textureCanvas.width; x++) {
            const noise = Math.random() * 10 - 5;
            textureCtx.fillStyle = `rgba(${noise}, ${noise}, ${noise}, 0.1)`;
            textureCtx.fillRect(x, y, 1, 1);
        }
    }

    // 将纹理叠加到图像上
    tempCtx.globalCompositeOperation = 'overlay';
    tempCtx.drawImage(textureCanvas, 0, 0);
    tempCtx.globalCompositeOperation = 'source-over';

    // 绘制到结果画布
    resultCtx.drawImage(tempCanvas, 0, 0, resultCanvas.width, resultCanvas.height);
}

// 二次元风格处理
function applyComicStyle(enhancedCanvas) {
    // 创建临时画布进行处理
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    tempCanvas.width = enhancedCanvas.width;
    tempCanvas.height = enhancedCanvas.height;

    // 绘制增强后的图像
    tempCtx.drawImage(enhancedCanvas, 0, 0);

    // 1. 应用自定义边缘检测
    const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    const edgeData = new Uint8ClampedArray(data.length);

    // Sobel算子边缘检测
    const sobelX = [
        [-1, 0, 1],
        [-2, 0, 2],
        [-1, 0, 1]
    ];

    const sobelY = [
        [-1, -2, -1],
        [0, 0, 0],
        [1, 2, 1]
    ];

    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            let gx = 0, gy = 0;

            // 计算梯度
            for (let ky = -1; ky <= 1; ky++) {
                for (let kx = -1; kx <= 1; kx++) {
                    const pixelIndex = ((y + ky) * width + (x + kx)) * 4;
                    const gray = (data[pixelIndex] + data[pixelIndex + 1] + data[pixelIndex + 2]) / 3;
                    gx += gray * sobelX[ky + 1][kx + 1];
                    gy += gray * sobelY[ky + 1][kx + 1];
                }
            }

            // 计算梯度幅度
            const magnitude = Math.sqrt(gx * gx + gy * gy);
            const edgeValue = Math.min(255, magnitude);
            const pixelIndex = (y * width + x) * 4;

            edgeData[pixelIndex] = edgeValue;
            edgeData[pixelIndex + 1] = edgeValue;
            edgeData[pixelIndex + 2] = edgeValue;
            edgeData[pixelIndex + 3] = data[pixelIndex + 3];
        }
    }

    // 2. 应用卡通化效果 ( bilateral filter )
    const filteredData = new Uint8ClampedArray(data.length);
    const kernelSize = 5;
    const kernelRadius = Math.floor(kernelSize / 2);
    const sigmaSpace = 5;
    const sigmaColor = 30;

    for (let y = kernelRadius; y < height - kernelRadius; y++) {
        for (let x = kernelRadius; x < width - kernelRadius; x++) {
            for (let c = 0; c < 3; c++) {
                let sum = 0;
                let weightSum = 0;
                const centerValue = data[(y * width + x) * 4 + c];

                for (let ky = -kernelRadius; ky <= kernelRadius; ky++) {
                    for (let kx = -kernelRadius; kx <= kernelRadius; kx++) {
                        const pixelIndex = ((y + ky) * width + (x + kx)) * 4;
                        const pixelValue = data[pixelIndex + c];

                        // 空间权重
                        const spaceWeight = Math.exp(-(ky * ky + kx * kx) / (2 * sigmaSpace * sigmaSpace));
                        // 颜色权重
                        const colorWeight = Math.exp(-Math.pow(pixelValue - centerValue, 2) / (2 * sigmaColor * sigmaColor));
                        // 总权重
                        const weight = spaceWeight * colorWeight;

                        sum += pixelValue * weight;
                        weightSum += weight;
                    }
                }

                filteredData[(y * width + x) * 4 + c] = Math.round(sum / weightSum);
            }
            filteredData[(y * width + x) * 4 + 3] = data[(y * width + x) * 4 + 3];
        }
    }

    // 3. 合并边缘和卡通效果
    for (let i = 0; i < data.length; i += 4) {
        // 如果是边缘像素，则加深
        if (edgeData[i] > 100) {
            data[i] = Math.max(0, filteredData[i] * 0.7);
            data[i + 1] = Math.max(0, filteredData[i + 1] * 0.7);
            data[i + 2] = Math.max(0, filteredData[i + 2] * 0.7);
        } else {
            data[i] = filteredData[i];
            data[i + 1] = filteredData[i + 1];
            data[i + 2] = filteredData[i + 2];
        }
    }

    // 4. 调整颜色饱和度和对比度
    for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        // 转换为HSV
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        let h, s, v = max / 255;
        const delta = max - min;

        s = max === 0 ? 0 : delta / max;

        if (max === min) {
            h = 0;
        } else if (max === r) {
            h = ((g - b) / delta) % 6;
        } else if (max === g) {
            h = (b - r) / delta + 2;
        } else {
            h = (r - g) / delta + 4;
        }

        h = Math.round(h * 60);
        if (h < 0) h += 360;

        // 增强饱和度和对比度
        s = Math.min(s * 1.5, 1);
        v = Math.min(v * 1.2, 1);

        // 转回RGB
        let newR, newG, newB;

        const c = v * s;
        const x = c * (1 - Math.abs((h / 60) % 2 - 1));
        const m = v - c;

        if (h >= 0 && h < 60) {
            newR = c; newG = x; newB = 0;
        } else if (h >= 60 && h < 120) {
            newR = x; newG = c; newB = 0;
        } else if (h >= 120 && h < 180) {
            newR = 0; newG = c; newB = x;
        } else if (h >= 180 && h < 240) {
            newR = 0; newG = x; newB = c;
        } else if (h >= 240 && h < 300) {
            newR = x; newG = 0; newB = c;
        } else {
            newR = c; newG = 0; newB = x;
        }

        newR = Math.round((newR + m) * 255);
        newG = Math.round((newG + m) * 255);
        newB = Math.round((newB + m) * 255);

        data[i] = newR;
        data[i + 1] = newG;
        data[i + 2] = newB;
    }

    tempCtx.putImageData(imageData, 0, 0);

    // 绘制到结果画布
    resultCtx.drawImage(tempCanvas, 0, 0, resultCanvas.width, resultCanvas.height);
}

// 加载face-api模型
async function loadModels() {
    try {
        console.log('开始加载人脸检测模型...');
        // 添加模型加载进度提示
        const statusElement = document.createElement('div');
        statusElement.id = 'modelStatus';
        statusElement.style.position = 'absolute';
        statusElement.style.top = '10px';
        statusElement.style.left = '10px';
        statusElement.style.backgroundColor = 'rgba(0,0,0,0.7)';
        statusElement.style.color = 'white';
        statusElement.style.padding = '5px 10px';
        statusElement.style.borderRadius = '5px';
        statusElement.textContent = '正在加载模型...';
        document.body.appendChild(statusElement);

        // 尝试从多个源加载模型
        try {
            await faceapi.nets.tinyFaceDetector.loadFromUri('https://justadudewhohacks.github.io/face-api.js/models');
            statusElement.textContent = '已加载人脸检测器模型';
            await faceapi.nets.faceLandmark68Net.loadFromUri('https://justadudewhohacks.github.io/face-api.js/models');
            statusElement.textContent = '已加载人脸关键点模型';
        } catch (primaryError) {
            console.warn('主源模型加载失败，尝试备用源...', primaryError);
            statusElement.textContent = '主源加载失败，尝试备用源...';
            await faceapi.nets.tinyFaceDetector.loadFromUri('https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/models');
            statusElement.textContent = '已从备用源加载人脸检测器模型';
            await faceapi.nets.faceLandmark68Net.loadFromUri('https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/models');
            statusElement.textContent = '已从备用源加载人脸关键点模型';
        }

        isModelLoaded = true;
        console.log('模型加载成功');
        statusElement.textContent = '模型加载成功，可以开始使用';
        setTimeout(() => {
            statusElement.remove();
        }, 3000);

        if (isVideoStarted) {
            detectFaces();
        }
    } catch (error) {
        console.error('模型加载失败:', error);
        alert('人脸检测模型加载失败，请检查网络连接。\n错误详情: ' + error.message);
    }
}

// 创建离屏Canvas用于人脸检测
const offscreenCanvas = document.createElement('canvas');
const offscreenCtx = offscreenCanvas.getContext('2d');

// 添加全局变量用于人脸跟踪和稳定性
let lastFaceBox = null;
let faceDetectionInterval = 0;
const MAX_DETECTION_INTERVAL = 7; // 减少检测频率至每7帧一次
const TRACKING_THRESHOLD = 40; // 缩小跟踪阈值
let consecutiveDetections = 0;
const MIN_CONSECUTIVE_DETECTIONS = 3; // 增加连续检测次数要求
let smoothedFaceBox = null;
const MIN_BOX_SIZE = 100; // 最小人脸框尺寸
const LANDMARK_CONFIDENCE_THRESHOLD = 0.5; // 关键点置信度阈值
const SMOOTHING_FACTOR = 0.7; // 增加平滑因子
let detectionHistory = [];
const MAX_HISTORY_LENGTH = 5; // 检测历史长度

// 检测人脸
async function detectFaces() {
    if (!isVideoStarted) return;

    // 确保离屏Canvas尺寸与主Canvas一致
    offscreenCanvas.width = canvas.width;
    offscreenCanvas.height = canvas.height;
    const ctx = offscreenCanvas.getContext('2d');
    // 完全清除画布，包括透明度
    ctx.clearRect(0, 0, offscreenCanvas.width, offscreenCanvas.height);

    // 控制检测频率
    faceDetectionInterval++;
    if (faceDetectionInterval < MAX_DETECTION_INTERVAL) {
        // 使用平滑后的检测结果绘制
        if (smoothedFaceBox) {
            drawFaceBoxAndLandmarks(ctx, smoothedFaceBox, faceLandmarks);
        }
        animationId = requestAnimationFrame(detectFaces);
        return;
    }
    faceDetectionInterval = 0;

    try {
        const detections = await faceapi.detectAllFaces(
            video, 
            new faceapi.TinyFaceDetectorOptions({
                inputSize: 640,  // 显著增加输入大小提高精度
                scoreThreshold: 0.95  // 进一步提高阈值至0.95
            })
        ).withFaceLandmarks();

        // 筛选出有效人脸 - 极高置信度且尺寸足够大
        const validDetections = detections.filter(d => 
            d.detection.score > 0.95 && 
            d.detection.box.width > MIN_BOX_SIZE * 1.2 && 
            d.detection.box.height > MIN_BOX_SIZE * 1.2
        );

        let bestDetection = null;
        if (validDetections.length > 0) {
            // 只取置信度最高的单个检测结果
            bestDetection = validDetections[0];

            // 连续检测计数
            consecutiveDetections++;

            // 只有当连续检测次数足够时才更新人脸位置
            if (consecutiveDetections >= MIN_CONSECUTIVE_DETECTIONS) {
                faceLandmarks = bestDetection.landmarks;
                lastFaceBox = bestDetection.detection.box;

                // 记录检测历史用于加权平均
                detectionHistory.push(lastFaceBox);
                if (detectionHistory.length > MAX_HISTORY_LENGTH) {
                    detectionHistory.shift();
                }

                // 多历史帧加权平滑
                smoothedFaceBox = smoothFaceBox(detectionHistory);
            }
        } else {
            // 未检测到有效人脸
            faceLandmarks = null;
            consecutiveDetections = 0;
            detectionHistory = [];
            lastFaceBox = null;
            smoothedFaceBox = null;
        }

        // 绘制最终结果
        if (smoothedFaceBox) {
            drawFaceBoxAndLandmarks(ctx, smoothedFaceBox, faceLandmarks);
        }

    } catch (error) {
        console.error('人脸检测错误:', error);
    } finally {
        // 确保始终请求下一帧
        animationId = requestAnimationFrame(detectFaces);
    }
}

// 辅助函数: 绘制人脸框和关键点
function drawFaceBoxAndLandmarks(ctx, faceBox, landmarks) {
    // 绘制单个绿色人脸框
    ctx.strokeStyle = 'green';
    ctx.lineWidth = 2;
    ctx.strokeRect(
        Math.round(faceBox.x),
        Math.round(faceBox.y),
        Math.round(faceBox.width),
        Math.round(faceBox.height)
    );

    // 绘制筛选后的关键点（减少噪点）
    if (landmarks && landmarks.positions) {
        ctx.fillStyle = 'blue';
        // 只绘制关键面部特征点（眼睛、鼻子、嘴巴）
        const keyLandmarks = getKeyFacialLandmarks(landmarks.positions);
        keyLandmarks.forEach(point => {
            ctx.beginPath();
            ctx.arc(Math.round(point.x), Math.round(point.y), 2, 0, 2 * Math.PI);
            ctx.fill();
        });
    }
}

// 辅助函数: 筛选关键面部特征点
function getKeyFacialLandmarks(allLandmarks) {
    // 只返回眼睛、鼻子和嘴巴区域的关键点（减少噪点）
    // 根据face-api.js的68点特征模型选择关键点位
    const keyIndices = [
        // 左眼
        36, 37, 38, 39, 40, 41,
        // 右眼
        42, 43, 44, 45, 46, 47,
        // 鼻子
        27, 28, 29, 30, 31, 32, 33, 34, 35,
        // 嘴巴
        48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59
    ];
    return keyIndices.map(index => allLandmarks[index]);
}

// 辅助函数: 找到与上次检测位置最接近的人脸
function findClosestDetection(detections, lastBox) {
    const centerX = lastBox.x + lastBox.width / 2;
    const centerY = lastBox.y + lastBox.height / 2;

    let closestDetection = detections[0];
    let minDistance = Infinity;

    for (const detection of detections) {
        const box = detection.detection.box;
        const detCenterX = box.x + box.width / 2;
        const detCenterY = box.y + box.height / 2;
        const distance = Math.sqrt(
            Math.pow(detCenterX - centerX, 2) +
            Math.pow(detCenterY - centerY, 2)
        );

        if (distance < minDistance && distance < TRACKING_THRESHOLD) {
            minDistance = distance;
            closestDetection = detection;
        }
    }
    return closestDetection;
}

// 辅助函数: 多帧历史加权平滑
function smoothFaceBox(history) {
    const sumBox = history.reduce((sum, box) => {
        sum.x += box.x * (sum.count + 1); // 近期帧权重更高
        sum.y += box.y * (sum.count + 1);
        sum.width += box.width * (sum.count + 1);
        sum.height += box.height * (sum.count + 1);
        sum.totalWeight += (sum.count + 1);
        sum.count++;
        return sum;
    }, {x: 0, y: 0, width: 0, height: 0, count: 0, totalWeight: 0});

    return {
        x: sumBox.x / sumBox.totalWeight,
        y: sumBox.y / sumBox.totalWeight,
        width: sumBox.width / sumBox.totalWeight,
        height: sumBox.height / sumBox.totalWeight
    };
}





// 开始绘制
function startDrawing(e) {
    isDrawing = true;
    [lastX, lastY] = getCoordinates(e);
}

// 绘制
function draw(e) {
    if (!isDrawing) return;
    const [x, y] = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(x, y);
    ctx.strokeStyle = currentColor;
    ctx.lineWidth = currentSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    [lastX, lastY] = [x, y];
}

// 停止绘制
function stopDrawing() {
    isDrawing = false;
}

// 获取坐标（支持鼠标和触摸）
function getCoordinates(e) {
    // 获取Canvas的边界矩形
    const rect = canvas.getBoundingClientRect();
    let x, y;

    if (e.type.includes('mouse')) {
        x = e.offsetX;
        y = e.offsetY;
    } else if (e.type.includes('touch')) {
        x = e.touches[0].clientX - rect.left;
        y = e.touches[0].clientY - rect.top;
    } else {
        return [0, 0];
    }

    // 使用比例因子转换坐标
    const scaleX = window.canvasScaleX || 1;
    const scaleY = window.canvasScaleY || 1;
    return [x * scaleX, y * scaleY];
}

// 事件监听
startBtn.addEventListener('click', startVideo);
stopBtn.addEventListener('click', stopVideo);
clearBtn.addEventListener('click', clearCanvas);
captureBtn.addEventListener('click', captureImage);
convertBtn.addEventListener('click', convertStyle);
colorPicker.addEventListener('input', (e) => {
    currentColor = e.target.value;
});
brushSize.addEventListener('input', (e) => {
    currentSize = e.target.value;
});

// 鼠标事件
canvas.addEventListener('mousedown', startDrawing);
canvas.addEventListener('mousemove', draw);
canvas.addEventListener('mouseup', stopDrawing);
canvas.addEventListener('mouseout', stopDrawing);

// 触摸事件（移动设备）
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault(); // 防止浏览器默认行为
    startDrawing(e);
});
canvas.addEventListener('touchmove', (e) => {
    e.preventDefault(); // 防止滚动
    draw(e);
});
canvas.addEventListener('touchend', stopDrawing);

// 窗口大小变化时调整Canvas尺寸
window.addEventListener('resize', setCanvasSize);

// 加载模型
loadModels();