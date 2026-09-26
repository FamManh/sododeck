**1. “Có ý tưởng app nhưng không biết bắt đầu từ đâu?”**

**Hook:** “Bạn mở Claude lên, định nhờ nó làm một ứng dụng, rồi không biết phải mô tả thế nào?”

**Bối cảnh:** “Mình đang làm một công cụ giúp đọc sơ đồ hệ thống dễ hơn, nhưng ý tưởng ban đầu cũng chỉ có đúng một câu như vậy.”

**Diễn biến:** Quay cách yêu cầu Claude hỏi ngược về người dùng, vấn đề và một tình huống sử dụng cụ thể. Hiện câu mô tả trước và sau khi trao đổi.

**Chốt:** “Trước khi nhờ AI code, thử nhờ nó giúp bạn làm rõ: ai sẽ dùng và họ cần làm được việc gì.”

**Giá trị riêng:** Cách bắt đầu khi ý tưởng còn mơ hồ.

---

**2. “Cho AI một yêu cầu mơ hồ, bạn sẽ nhận lại những quyết định nó tự đoán”**

**Hook:** “‘Thêm tính năng xem luồng nghiệp vụ’ — nghe rõ rồi đúng không? Nhưng bấm vào đâu, hiện cái gì, gặp lỗi thì sao?”

**Bối cảnh:** “Trong app sơ đồ mình đang xây, người dùng cần chọn một luồng để xem từng bước xử lý.”

**Diễn biến:** Đặt hai yêu cầu cạnh nhau: một dòng chung chung và phiên bản có thao tác, kết quả mong đợi, trường hợp lỗi. Quay cách dùng Claude viết và rà soát phần spec đó.

**Chốt:** “Mình kiểm tra yêu cầu bằng một câu: đọc xong, mình có biết phải bấm gì để xác nhận tính năng đã đúng chưa?”

**Giá trị riêng:** Cách viết yêu cầu để AI ít phải đoán.

---

**3. “Xem thử giao diện trước khi dành cả tuần để code”**

**Hook:** “Đây là giao diện ứng dụng mình muốn làm. Nó vẫn đang là prototype.”

**Bối cảnh:** “App này dùng để xem sơ đồ hệ thống và lần theo từng luồng nghiệp vụ.”

**Diễn biến:** Quay brief gửi Claude Design, rồi thử ba trạng thái: toàn bộ sơ đồ, chọn một flow, mở chi tiết một bước. Chỉ ra một quyết định bố cục cần sửa, chẳng hạn panel che mất vùng đang xem.

**Chốt:** “Màn hình này giúp mình phát hiện vấn đề bố cục trước khi triển khai tính năng thật.”

**Giá trị riêng:** Dùng prototype để kiểm tra ý tưởng giao diện.

---

**4. “Nhờ AI thiết kế logo: đừng chỉ nhìn bản phóng to”**

**Hook:** “Logo này nhìn lớn khá ổn. Thu xuống tab trình duyệt thì sao?”

**Bối cảnh:** “Mình đang thử logo cho Sododeck, một công cụ làm việc với sơ đồ hệ thống.”

**Diễn biến:** Quay brief cho Codex, so sánh vài phương án ở kích thước nhỏ, nền sáng, nền tối và cạnh tên sản phẩm.

**Chốt:** “Mình chọn logo sau khi đặt nó vào những chỗ sẽ dùng thật: tab trình duyệt, thanh công cụ và màn hình mở đầu.”

**Giá trị riêng:** Một cách đánh giá logo AI tạo ra.

---

**5. “Setup dự án bằng AI: giao việc đầu tiên nhỏ đến mức nào?”**

**Hook:** “Việc đầu tiên mình giao AI chỉ là: mở trang, thêm một ô và kéo nó được.”

**Bối cảnh:** “Mình đang xây một ứng dụng vẽ sơ đồ, nên đây là tương tác nền tảng cần chạy trước.”

**Diễn biến:** Hiện yêu cầu có phạm vi rõ, cắt nhanh quá trình tạo dự án, rồi tự mở ứng dụng và kiểm tra thao tác.

**Chốt:** “Một đầu việc nhỏ, có thể kiểm tra ngay, giúp mình biết dự án đã có nền để làm tiếp.”

**Giá trị riêng:** Cách chia nhiệm vụ đầu tiên cho coding agent.

---

**6. “Muốn người dùng mở app là dùng được — dữ liệu lưu ở đâu?”**

**Hook:** “Mình muốn người dùng không cần đăng nhập vẫn dùng được app. Nhưng đóng tab rồi thì bản vẽ có còn không?”

**Bối cảnh:** “Đây là quyết định mình đang xử lý cho một ứng dụng sơ đồ.”

**Diễn biến:** Vẽ ba phần đơn giản: giao diện → model dữ liệu → lưu ở trình duyệt. Giải thích thiết kế local-first đang chọn. Nếu đã triển khai, quay sửa sơ đồ rồi tải lại trang.

**Chốt:** “Bỏ màn hình đăng nhập khỏi trải nghiệm đầu tiên kéo theo một việc rất cụ thể: phải thiết kế cách lưu và lấy lại dữ liệu ngay từ đầu.”

**Giá trị riêng:** Hiểu một quyết định system design qua trải nghiệm người dùng.

---

**7. “Hai màn hình cùng sửa một dữ liệu: làm sao khỏi lệch nhau?”**

**Hook:** “Mình đổi tên ở đây, bên kia phải đổi theo. Nhưng nếu bên kia đang nhập dở thì sao?”

**Bối cảnh:** “App sơ đồ này cho phép chỉnh bằng kéo thả hoặc sửa JSON trực tiếp.”

**Diễn biến:** Demo đổi tên hai chiều, rồi thử nhập JSON chưa hợp lệ. Giải thích quyết định về lúc áp dụng thay đổi và cách hiển thị lỗi.

**Chốt:** “Trước khi nối hai cách chỉnh sửa với nhau, mình cần xác định dữ liệu nào đang có hiệu lực và thay đổi nào chưa được chấp nhận.”

**Giá trị riêng:** Một bài toán đồng bộ dễ hiểu bằng hình ảnh.

---

**8. “Sơ đồ có 100 đường nối: làm sao giải thích đúng một nghiệp vụ?”**

**Hook:** “Trong sơ đồ này, đơn hàng giao thất bại sẽ đi đường nào?”

**Bối cảnh:** “Đây là lý do mình muốn xây Sododeck: giúp người xem lần theo một luồng cụ thể.”

**Diễn biến:** Cho thấy toàn bộ sơ đồ, chọn “Giao thất bại → Hoàn hàng”, làm nổi đường đi và mở điều kiện của một bước. Ghi rõ prototype nếu chưa chạy thật.

**Chốt:** “Khi giải thích một nghiệp vụ, mình muốn người xem tập trung được vào đường đi và điều kiện của chính nghiệp vụ đó.”

**Giá trị riêng:** Một cách trình bày hệ thống phức tạp dễ theo dõi hơn.

---

**9. “AI báo làm xong. Mình thử xóa một thứ.”**

**Hook:** “Tạo mới chạy tốt rồi. Giờ xóa một đường nối mà tính năng khác đang dùng thì sao?”

**Bối cảnh:** “Trong app sơ đồ của mình, một đường nối có thể được nhiều luồng nghiệp vụ tham chiếu.”

**Diễn biến:** Tạo tình huống kiểm tra, xóa đường nối và quan sát kết quả. Nếu có lỗi, quay cách mô tả lỗi cho agent và kiểm tra lại sau khi sửa.

**Chốt:** “Ngoài thao tác tạo mới, mình luôn thử sửa và xóa dữ liệu mà tính năng đang phụ thuộc vào.”

**Giá trị riêng:** Một cách kiểm tra sản phẩm do AI hỗ trợ xây dựng.

*Chỉ mô tả lỗi thực tế; nếu mọi thứ xử lý đúng, video vẫn có giá trị như một bài kiểm tra.*

---

**10. “Spec càng dài, có chắc AI càng hiểu đúng?”**

**Hook:** “Tài liệu này quyết định dùng JSON. Nhưng ở phần khác lại ghi YAML.”

**Bối cảnh:** “Đây là một chỗ lệch ngay trong spec ứng dụng mình đang làm.”

**Diễn biến:** Highlight hai đoạn trong tài liệu Sododeck. Quay cách nhờ Claude tìm mâu thuẫn, rồi tự xác nhận và sửa quyết định lưu bằng JSON cho thống nhất.

**Chốt:** “Trước khi đưa spec cho coding agent, mình dành một lượt chỉ để tìm những quyết định bị viết khác nhau ở các phần.”

**Giá trị riêng:** Cách rà soát tài liệu bằng một ví dụ thật.

---

**11. “Một mình build app: tính năng nào nên để sau?”**

**Hook:** “Mình muốn app có AI, đồng bộ, cộng tác và đọc codebase. Nhưng bản đầu tiên cần chứng minh điều gì?”

**Bối cảnh:** “Với Sododeck, điều mình muốn kiểm chứng là người dùng có thấy việc lần theo flow hữu ích hay không.”

**Diễn biến:** Hiện danh sách tính năng. Chọn một hành trình nhỏ: tạo sơ đồ → chọn flow → xem từng bước và rule. Giải thích lý do ưu tiên hành trình đó.

**Chốt:** “Mình chọn phần làm trước dựa trên câu hỏi cần kiểm chứng với người dùng.”

**Giá trị riêng:** Cách chọn phạm vi khi có quá nhiều ý tưởng.

---

**12. “Người dùng có hiểu cái nút mà mình thấy rất rõ không?”**

**Hook:** “Mình nghĩ nút này dễ hiểu, cho đến khi để người khác tự dùng thử.”

**Bối cảnh:** “Trong app sơ đồ này, người dùng cần tìm và chạy một luồng giao hàng.”

**Diễn biến:** Giao một nhiệm vụ ngắn, quan sát mà không hướng dẫn ngay. Chọn một tình huống thực tế họ dừng lại hoặc hiểu khác dự kiến. Đưa ra thay đổi từ quan sát đó.

**Chốt:** “Lần thử này giúp mình có một yêu cầu chỉnh sửa cụ thể để giao lại cho AI.”

**Giá trị riêng:** Cách biến quan sát người dùng thành việc cần làm.

*Chỉ dùng hook trên khi đã có tình huống thực tế tương ứng.*