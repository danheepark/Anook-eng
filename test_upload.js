const fs = require('fs');

async function testUpload() {
  try {
    const imagePath = '/Users/seobeom/Desktop/team3-Anook/broken_toilet.png';
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = `data:image/png;base64,${imageBuffer.toString('base64')}`;
    
    console.log("1. 프론트엔드 API로 이미지 전송 중...");
    
    const formData = new FormData();
    formData.append('content', '변기가 깨졌어요 ㅠㅠ');
    formData.append('images', base64Image);

    const response = await fetch('http://localhost:3000/api/chat/707/messages', {
      method: 'POST',
      body: formData,
      headers: {
        // Mock session cookie if needed, but the route might not need it for local testing if we pass roomNo in URL
      }
    });

    if (!response.ok) {
      console.log("에러 발생:", response.status, await response.text());
      return;
    }
    
    const data = await response.json();
    console.log("✅ 2. 전송 완료! 백엔드 응답:", data);
  } catch (err) {
    console.error("테스트 실패:", err);
  }
}
testUpload();
