// Danh sách lọc từ ngữ không phù hợp cơ bản để giữ gìn sự trang nghiêm nơi cửa Phật
const PROFANE_WORDS = [
  'dm', 'đm', 'dmm', 'đmm', 'vcl', 'vkl', 'vl', 'cl', 'clgt', 'cc', 'đéo', 'deo',
  'lồn', 'lon', 'cặc', 'cac', 'buồi', 'buoi', 'chó', 'đụ', 'du ma', 'đụ má',
  'mẹ mày', 'me may', 'óc chó', 'oc cho', 'khốn nạn', 'đĩ', 'di~', 'bitch', 'fuck'
];

export function cleanText(input: string, maxLen = 160): string {
  if (!input) return '';
  // Xóa ký tự điều khiển lạ
  let cleaned = input.replace(/[\u0000-\u001F\u007F-\u009F]/g, '').trim();
  if (cleaned.length > maxLen) {
    cleaned = cleaned.substring(0, maxLen);
  }

  // Thay thế từ ngữ thô tục bằng hoa sen hoặc ngôi sao
  let lower = cleaned.toLowerCase();
  for (const word of PROFANE_WORDS) {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    if (regex.test(cleaned)) {
      cleaned = cleaned.replace(regex, '***');
    }
  }

  return cleaned;
}
