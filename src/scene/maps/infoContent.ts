// Nội dung các bảng thông tin trong cảnh (đứng gần bia / biển tầng thì hiện lên).
// Muốn sửa chữ: sửa trực tiếp ở đây, không cần đụng tới phần dựng hình.

export interface InfoContent {
  title: string;
  subtitle?: string;
  sin?: string;       // Tội (dành cho kẻ...)
  punish?: string;    // Quả báo / hình phạt
  advice?: string;    // Hướng thiện
  body?: string;      // Đoạn giới thiệu chung
  note?: string;      // Ghi chú thêm (hiện ở cuối, chữ nhỏ)
}

export interface HellLevel {
  n: number;
  name: string;       // Tên Hán Việt
  short: string;      // Tên ngắn khắc trên biển
  meaning: string;    // Nghĩa
  sin: string;
  punish: string;
  advice: string;
}

export const HELL_LEVELS: HellLevel[] = [
  { n: 1, name: 'Bạt Thiệt Địa Ngục', short: 'BẠT THIỆT', meaning: 'Ngục kéo lưỡi',
    sin: 'Kẻ lúc sống hay nói dối, chia rẽ, chửi rủa, lừa gạt.',
    punish: 'Bị quỷ dùng kìm sắt kẹp chặt lưỡi rồi kéo dài ra.',
    advice: 'Giữ lời chân thật, nói lời ái ngữ; không nói lời chia rẽ, thêu dệt.' },
  { n: 2, name: 'Cắt Đao Địa Ngục', short: 'CẮT ĐAO', meaning: 'Ngục kéo cắt',
    sin: 'Kẻ xúi giục phụ nữ góa chồng tái giá hoặc làm mai mối lừa đảo.',
    punish: 'Bị quỷ cắt đứt mười đầu ngón tay.',
    advice: 'Tôn trọng lựa chọn và hạnh phúc của người khác; không lấy chuyện nhân duyên ra lừa lọc.' },
  { n: 3, name: 'Thiết Thụ Địa Ngục', short: 'THIẾT THỤ', meaning: 'Ngục cây chông sắt',
    sin: 'Kẻ chia rẽ tình mẫu tử, tình anh em ruột thịt.',
    punish: 'Bị cắm vào những cành cây chông sắt nhọn hoắt.',
    advice: 'Vun đắp tình thân, hoà giải bất hoà trong gia đình.' },
  { n: 4, name: 'Nghiệt Kính Địa Ngục', short: 'NGHIỆT KÍNH', meaning: 'Ngục gương soi tội',
    sin: 'Kẻ phạm tội nhưng trốn tránh, che giấu lỗi lầm.',
    punish: 'Linh hồn phải soi vào gương thần để hiện rõ mọi tội ác, sau đó chuyển sang các tầng ngục khác để chịu phạt.',
    advice: 'Biết nhận lỗi và sửa lỗi; sám hối chân thành thì tâm được nhẹ nhàng.' },
  { n: 5, name: 'Chưng Lung Địa Ngục', short: 'CHƯNG LUNG', meaning: 'Ngục lồng hấp',
    sin: 'Kẻ hay tung tin đồn nhảm, hãm hại người lương thiện.',
    punish: 'Bị nhốt vào lồng kín rồi đốt lửa hấp sống, sau đó gió lạnh thổi vào cho sống lại để phạt tiếp.',
    advice: 'Không nghe, không truyền lời đồn; nói về người khác như khi họ đang có mặt.' },
  { n: 6, name: 'Đồng Trụ Địa Ngục', short: 'ĐỒNG TRỤ', meaning: 'Ngục cột đồng đốt nóng',
    sin: 'Kẻ phóng hỏa giết người, hủy hoại tài sản hoặc bằng chứng.',
    punish: 'Bị lột sạch quần áo rồi ôm chặt vào cột đồng đang đốt đỏ rực.',
    advice: 'Giữ gìn của cải chung và của người; sống ngay thẳng, không che lấp sự thật.' },
  { n: 7, name: 'Đao Sơn Địa Ngục', short: 'ĐAO SƠN', meaning: 'Ngục núi dao',
    sin: 'Kẻ sát sinh vô tội vạ, giết hại động vật hoặc con người.',
    punish: 'Phải trần truồng trèo qua ngọn núi đầy dao sắc nhọn.',
    advice: 'Thương yêu muôn loài, phóng sinh, ăn chay khi có thể.' },
  { n: 8, name: 'Băng Sơn Địa Ngục', short: 'BĂNG SƠN', meaning: 'Ngục núi băng',
    sin: 'Kẻ thông dâm, bất hiếu, cờ bạc, phụ bạc tình nghĩa.',
    punish: 'Bị lột đồ và đày lên ngọn núi băng lạnh giá cho đến khi cơ thể đông cứng, nứt nẻ.',
    advice: 'Chung thuỷ, hiếu thảo với cha mẹ; tránh xa cờ bạc.' },
  { n: 9, name: 'Dầu Oa Địa Ngục', short: 'DẦU OA', meaning: 'Ngục vạc dầu',
    sin: 'Kẻ trộm cắp, bắt nạt người yếu thế, lừa thầy phản bạn.',
    punish: 'Bị quỷ ném vào vạc dầu sôi sùng sục.',
    advice: 'Không lấy của không cho; che chở người yếu, giữ trọn nghĩa thầy bạn.' },
  { n: 10, name: 'Ngưu Khanh Địa Ngục', short: 'NGƯU KHANH', meaning: 'Ngục trâu húc',
    sin: 'Kẻ ngược đãi động vật, giết trâu bò làm việc nghĩa vô cớ.',
    punish: 'Bị đưa vào hang, nơi có hàng vạn con trâu rừng hung hãn dùng sừng húc và giẫm đạp nát cơ thể.',
    advice: 'Biết ơn và đối xử tử tế với loài vật đã giúp sức cho con người.' },
  { n: 11, name: 'Thạch Áp Địa Ngục', short: 'THẠCH ÁP', meaning: 'Ngục đá đè',
    sin: 'Kẻ bỏ rơi, ngược đãi hoặc giết hại con trẻ.',
    punish: 'Bị đưa vào một chiếc hố lớn, phía trên thả những tảng đá khổng lồ xuống đè bẹp.',
    advice: 'Yêu thương, chăm sóc và bảo vệ trẻ nhỏ.' },
  { n: 12, name: 'Thung Cữu Địa Ngục', short: 'THUNG CỮU', meaning: 'Ngục giã cối',
    sin: 'Kẻ lãng phí lương thực, đồ ăn thức uống, hoặc mắng chửi người khác lúc ăn.',
    punish: 'Bị bỏ vào cối giã gạo khổng lồ và bị giã nát thịt xương.',
    advice: 'Quý trọng hạt cơm, ăn uống đủ dùng; giữ hoà khí trong bữa ăn.' },
  { n: 13, name: 'Huyết Trì Địa Ngục', short: 'HUYẾT TRÌ', meaning: 'Ngục bể máu',
    sin: 'Kẻ không tôn trọng cha mẹ, bất kính với thần phật, đi theo đường tà đạo.',
    punish: 'Bị dìm trong bể máu tanh hôi, chịu sự cắn xé của ác quỷ.',
    advice: 'Kính trọng cha mẹ, thầy tổ và Tam Bảo; tin sâu nhân quả, giữ chánh kiến.' },
  { n: 14, name: 'Uổng Tử Địa Ngục', short: 'UỔNG TỬ', meaning: 'Ngục chết oan / tự tử',
    sin: 'Kẻ không trân trọng mạng sống, tự sát (cắt tay, treo cổ...) khi chưa tận số.',
    punish: 'Linh hồn bị giam cầm trong sự u uất, chịu nỗi đau lặp đi lặp lại của việc tự tử mà không thể đầu thai.',
    advice: 'Thân người khó được. Khi khổ đau, hãy tìm đến người thân, bạn bè, thầy cô hay chuyên gia để được lắng nghe và giúp đỡ.' },
  { n: 15, name: 'Trách Trai Địa Ngục', short: 'TRÁCH TRAI', meaning: 'Ngục phanh thây',
    sin: 'Kẻ đào mộ, trộm cắp quan tài, phá hoại nơi an nghỉ của người chết.',
    punish: 'Bị quỷ dùng cưa phanh thây thành nhiều mảnh.',
    advice: 'Tôn kính người đã khuất, gìn giữ mồ mả, nơi an nghỉ.' },
  { n: 16, name: 'Hỏa Diệm Địa Ngục', short: 'HỎA DIỆM', meaning: 'Ngục lửa thiêu',
    sin: 'Kẻ tham nhũng, ăn hối lộ, lừa đảo chiếm đoạt tài sản công.',
    punish: 'Bị tống vào lò lửa lớn thiêu đốt liên tục.',
    advice: 'Liêm chính, chí công vô tư; của công phải giữ như giữ của mình.' },
  { n: 17, name: 'Thạch Bàn Địa Ngục', short: 'THẠCH BÀN', meaning: 'Ngục cối đá xay',
    sin: 'Kẻ đè nén, bóc lột dân nghèo, buôn gian bán lận.',
    punish: 'Bị ép vào cối đá xay thịt nghiền thành bột cám.',
    advice: 'Làm ăn lương thiện, chia sẻ với người nghèo khó.' },
  { n: 18, name: 'Đao Cư Địa Ngục', short: 'ĐAO CƯ', meaning: 'Ngục cưa xẻ',
    sin: 'Kẻ buôn bán bất chính, dùng cân điêu gian lận, lừa gạt phụ nữ và trẻ em.',
    punish: 'Linh hồn bị trói vào cột và dùng cưa sắt xẻ dọc từ trên đầu xuống.',
    advice: 'Cân đủ, đong đầy, buôn bán thật thà; không lừa người yếu thế.' }
];

const INFO: Record<string, InfoContent> = {
  'hell-0': {
    title: 'Luật Nhân Quả',
    subtitle: 'Gieo nhân nào, gặt quả nấy',
    body: 'Mười tám tầng địa ngục là hình ảnh răn dạy trong văn hoá Phật giáo dân gian: mỗi việc ác đều để lại quả báo tương ứng. Hãy đi hết ba hành lang, đọc từng tầng để tự soi lại mình, rồi đến điện Địa Tạng Bồ Tát ở cuối hang để sám hối và phát nguyện làm lành.'
  },
  'hell-19': {
    title: 'Địa Tạng Vương Bồ Tát',
    subtitle: '"Địa ngục vị không, thệ bất thành Phật"',
    body: 'Ngài phát đại nguyện: chừng nào địa ngục còn chúng sinh thì Ngài chưa thành Phật. Biết lỗi mà sám hối, phát nguyện dứt ác làm lành, thì nghiệp xấu dần chuyển hoá. Hãy thắp hương, lễ lạy và bấm "Sám hối" trước tượng Ngài.'
  },
  'pagoda-guanyin': {
    title: 'Quán Thế Âm Bồ Tát Thiên Thủ Thiên Nhãn',
    subtitle: 'Nghìn tay nghìn mắt',
    body: 'Nghìn mắt để thấy hết nỗi khổ của chúng sinh, nghìn tay để cứu giúp khắp nơi. Pho tượng ở đây có đúng một nghìn cánh tay, mỗi lòng bàn tay có một con mắt; bốn mươi hai tay lớn cầm pháp khí, trên đỉnh đầu xếp tầng các khuôn mặt từ bi.'
  },
  'pagoda-tower': {
    title: 'Bảo Tháp',
    subtitle: 'Tháp bảy tầng và vườn tháp',
    body: 'Bảo tháp bảy tầng là nơi tôn thờ Xá Lợi. Hai bên sân là vườn tháp mộ của chư Tổ, chư Tăng đời trước. Đi nhiễu quanh tháp, chắp tay niệm Phật là một cách tu tập tịnh tâm.'
  },
  'zen-guide': {
    title: 'Hướng dẫn ngồi thiền',
    subtitle: 'Thiền Đường',
    body: 'Bấm "Ngồi thiền" để tự đi đến bồ đoàn trống gần nhất. Ngồi thẳng lưng, thả lỏng vai, mắt khép hờ. Theo dõi vòng tròn: hít vào khi vòng nở ra, thở ra khi vòng thu lại. Ở Thiền Đường, mỗi 30 giây ngồi thiền được cộng 2 công đức. Bấm lại "Ngồi thiền" để xả thiền.'
  }
};

export function getInfo(id: string): InfoContent | null {
  const m = /^hell-(\d+)$/.exec(id);
  if (m) {
    const n = Number(m[1]);
    const L = HELL_LEVELS[n - 1];
    if (L) {
      return {
        title: `Tầng ${L.n}: ${L.name}`,
        subtitle: L.meaning,
        sin: L.sin,
        punish: L.punish,
        advice: L.advice,
        note: L.n === 14 ? 'Nếu bạn đang thấy bế tắc, đừng ở một mình với nỗi buồn: hãy nói chuyện với người bạn tin tưởng hoặc tìm đến chuyên gia tâm lý. Mạng sống của bạn rất quý giá.' : undefined
      };
    }
  }
  return INFO[id] || null;
}
