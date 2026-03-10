document.getElementById('downloadBtn').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const status = document.getElementById('status');
  const btn = document.getElementById('downloadBtn');

  btn.disabled = true;
  status.innerText = "正在抓取圖片...";

  chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: grabImagesAndTitle
  }, async (results) => {
    const imageUrls = results[0].result.urls;
    const title = results[0].result.title;
    
    if (!imageUrls || imageUrls.length === 0) {
      status.innerText = "找不到任何投影片圖片！";
      btn.disabled = false;
      return;
    }

    status.innerText = `準備轉換 ${imageUrls.length} 張圖片...`;

    ///////
    // 在 popup.js 的回呼函式內修改：
    const { jsPDF } = window.jspdf;
    let pdf = null;

    for (let i = 0; i < imageUrls.length; i++) {
      status.innerText = `處理中 (${i + 1}/${imageUrls.length})`;
      
      try {
        const imgData = await getBase64Image(imageUrls[i]);
        
        // 建立一個暫時的 Image 物件來獲取原始寬高
        const img = new Image();
        img.src = imgData;
        await new Promise(resolve => img.onload = resolve);

        const w = img.width;
        const h = img.height;

        // 第一張圖時，初始化 PDF，設定格式為 ['橫寬', '縱高']
        if (i === 0) {
          // orientation: 'l' (橫向), unit: 'px' (像素), format: [寬, 高]
          pdf = new jsPDF({
            orientation: w > h ? 'l' : 'p',
            unit: 'px',
            format: [w, h]
          });
        } else {
          // 之後的每一頁也根據該圖尺寸新增頁面
          pdf.addPage([w, h], w > h ? 'l' : 'p');
        }

        // 將圖片畫在 (0, 0) 位置，尺寸剛好等於頁面尺寸
        pdf.addImage(imgData, 'JPEG', 0, 0, w, h);
        
      } catch (err) {
        console.error("圖片載入失敗: " + imageUrls[i]);
      }
    }

    if (pdf) {
      pdf.save(`${title}.pdf`);
      status.innerText = "下載完成！";
    }

    btn.disabled = false;

    setTimeout(() => {
      window.close();
    }, 500);
  });
});

// 在目標網頁執行的函式
function grabImagesAndTitle() {
  const slides = document.querySelectorAll('section.slide img');
  const urls = [];
  slides.forEach(img => {
    // 處理相對路徑轉絕對路徑
    let src = img.getAttribute('src');
    if (src && !src.startsWith('http')) {
      src = window.location.origin + src;
    }
    urls.push(src);
  });
  
  let title  = document.querySelector('.title').innerHTML;
  const default_title = "eeclass_slides.pdf";
  let start = 0;
  let end = title.length-1;
  for(i=0;i<title.length;i++){
    if(title[i]==' ' || title[i]=='\n' || title[i]=='\t') {start++;}
    else {break;}
  }
  for(i=title.length-1;i>=0;i--){
    if(title[i]==' ' || title[i]=='\n' || title[i]=='\t') {end--;}
    else {break;}
  }

  if(start < end){
    title = title.substring(start,end+1);
  }
  else {
    title = default_title;
  }

  return {urls,title};
}

// 將圖片轉為 Base64 以供 jsPDF 使用
async function getBase64Image(url) {
  const response = await fetch(url);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}