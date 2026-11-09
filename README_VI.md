# 과제체크 – GCP/Firebase prototype

Prototype học tập cho đề tài: **클라우드 컴퓨팅을 활용한 대학생 과제 관리 및 마감 알림 시스템**.

## 1. Tính năng hiện có

- Demo mode để thử giao diện ngay, không cần tài khoản GCP.
- Firebase Authentication: đăng ký/đăng nhập email và mật khẩu (sau khi cấu hình Firebase).
- Cloud Firestore: thêm, sửa, xóa, hoàn thành và xem danh sách bài tập theo người dùng.
- Phân loại trạng thái: đang làm, sắp đến hạn (trong 24 giờ), quá hạn, hoàn thành.
- Browser notification khi trang web đang mở và người dùng cho phép thông báo.
- Firestore Security Rules giới hạn dữ liệu trong `users/{uid}/tasks/{taskId}` cho đúng chủ tài khoản.

## 2. Giới hạn quan trọng

MVP hiện tại **chưa gửi thông báo nền khi người dùng đóng trình duyệt**. Browser notification chỉ hoạt động khi website còn mở. Thông báo nền là giai đoạn 2, cần Firebase Cloud Messaging + service worker + Cloud Functions theo lịch/Cloud Scheduler và phải kiểm tra cấu hình thanh toán hiện hành.

Không lưu thông tin nhạy cảm hoặc dữ liệu bài tập quan trọng trong demo. Demo mode dùng localStorage trên trình duyệt hiện tại.

## 3. Chạy thử không cần GCP

1. Giải nén ZIP.
2. Mở terminal trong thư mục `assignment-check-gcp`.
3. Dùng một web server local. Ví dụ với Python:

   ```bash
   python -m http.server 5500 -d public
   ```

4. Mở `http://localhost:5500`.
5. Chọn **데모 모드로 체험하기**.
6. Thêm một môn học, tên bài tập và deadline gần để thử bộ đếm và cảnh báo.

`localhost` được trình duyệt xem là secure context cho nhiều API web, bao gồm Notifications trên các trình duyệt hỗ trợ.

## 4. Kết nối Firebase/GCP

### A. Tạo project

1. Mở https://console.firebase.google.com/ và chọn **Add project**.
2. Tạo project mới. Ví dụ Project ID: `assignment-check-demo-<unique-suffix>`.
3. Trong Project settings, tạo một Web App.
4. Sao chép cấu hình SDK.
5. Thay các giá trị `YOUR_...` trong `public/firebase-config.js` bằng cấu hình thật.

Lưu ý: Firebase project gắn với Google Cloud project. Nếu tạo Firestore, chọn khu vực `asia-northeast3` (Seoul) ngay từ đầu nếu phù hợp; khu vực cơ sở dữ liệu thường không thể đổi sau khi tạo.

### B. Bật Authentication

1. Firebase Console → Authentication → Get started.
2. Sign-in method → bật **Email/Password**.

### C. Tạo Firestore

1. Firebase Console → Firestore Database → Create database.
2. Chọn khu vực `asia-northeast3` nếu được cung cấp trong project.
3. Deploy rules trong file `firestore.rules`; không dùng public/test rules khi triển khai chia sẻ.

### D. Cài Firebase CLI và deploy Hosting + Rules

Cần Node.js và npm. Sau đó chạy:

```bash
npm install -g firebase-tools
firebase login
firebase projects:list
firebase use --add
firebase deploy --only hosting,firestore:rules
```

Ở bước `firebase use --add`, chọn đúng Project ID vừa tạo và đặt alias `default`.

Nếu CLI báo thiếu cấu hình local, chạy lệnh từ thư mục chứa `firebase.json`. Sau deploy, Firebase CLI sẽ in ra URL Hosting dạng `https://<project-id>.web.app`.

## 5. Cách kiểm thử để đưa vào báo cáo

Dùng hai tài khoản test riêng biệt (ví dụ account A và B) và thực hiện:

1. Đăng ký account A.
2. Thêm hai bài tập ở hai môn khác nhau.
3. Sửa tiêu đề hoặc deadline một bài.
4. Đánh dấu một bài đã hoàn thành.
5. Xóa một bài test.
6. Đăng xuất và đăng nhập lại để kiểm tra dữ liệu còn được lưu trên Firestore.
7. Đăng nhập account B và kiểm tra không nhìn thấy dữ liệu của A.
8. Tạo một bài có deadline trong 24 giờ, bật browser notifications, giữ website mở và kiểm tra cảnh báo.
9. Kiểm tra Firestore Rules bằng Rules Playground/Emulator nếu có thể.

Ghi kết quả thật: Pass/Fail, thời gian, lỗi phát sinh và ảnh chụp màn hình. Không ghi “đã kiểm thử thành công” nếu chưa thực hiện.

## 6. Cảnh báo chi phí

- Demo mode không sử dụng GCP.
- Firebase Hosting, Authentication và Firestore có hạn mức miễn phí nhưng giới hạn và điều kiện có thể thay đổi.
- Cloud Functions/Cloud Scheduler cho thông báo nền có thể yêu cầu Blaze billing. Trước khi bật billing, kiểm tra pricing và thiết lập budget alert.
- Budget alert là cảnh báo, không phải giới hạn chi tiêu cứng.

Tài liệu chính thức:
- https://firebase.google.com/docs/hosting
- https://firebase.google.com/docs/auth/web/start
- https://firebase.google.com/docs/firestore/quickstart
- https://firebase.google.com/docs/firestore/security/get-started
- https://firebase.google.com/docs/functions/schedule-functions
- https://firebase.google.com/docs/cloud-messaging/web/get-started
- https://firebase.google.com/pricing
