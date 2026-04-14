<?php
/* ═══════════════════════════════════════════════════════════
   contact.php — Secure contact form handler
   Deployed on Hostinger Cloud Startup (PHP 8+)
   ═══════════════════════════════════════════════════════════ */

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: same-origin');

// ── CORS: only allow requests from your own domain
$allowedOrigins = [
    'https://thierrybezier.com',
    'https://www.thierrybezier.com'
];
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (in_array($origin, $allowedOrigins, true)) {
    header('Access-Control-Allow-Origin: ' . $origin);
}

// ── Only POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'method']);
    exit;
}

// ── Read fields
$name    = trim($_POST['name']    ?? '');
$email   = trim($_POST['email']   ?? '');
$subject = trim($_POST['subject'] ?? '');
$message = trim($_POST['message'] ?? '');
$hp      = trim($_POST['website'] ?? ''); // honeypot

// ── Honeypot: silently drop bot submissions
if ($hp !== '') {
    echo json_encode(['ok' => true]);
    exit;
}

// ── Validation
$errors = [];
if ($name === ''    || mb_strlen($name)    > 100)  $errors[] = 'name';
if ($email === ''   || !filter_var($email, FILTER_VALIDATE_EMAIL) || mb_strlen($email) > 150) $errors[] = 'email';
if ($message === '' || mb_strlen($message) > 3000) $errors[] = 'message';
if (mb_strlen($subject) > 200) $errors[] = 'subject';

if ($errors) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'validation', 'fields' => $errors]);
    exit;
}

// ── Rate limiting (simple IP-based, 3 msgs / 10 min)
$rateDir = sys_get_temp_dir() . '/tb_rate';
if (!is_dir($rateDir)) @mkdir($rateDir, 0755, true);
$ip = $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
$rateFile = $rateDir . '/' . md5($ip);
$now = time();
$window = 600; // 10 minutes
$maxMsgs = 3;
$history = [];
if (is_file($rateFile)) {
    $history = json_decode(@file_get_contents($rateFile), true) ?: [];
    $history = array_filter($history, fn($t) => $t > ($now - $window));
}
if (count($history) >= $maxMsgs) {
    http_response_code(429);
    echo json_encode(['ok' => false, 'error' => 'rate_limit']);
    exit;
}
$history[] = $now;
@file_put_contents($rateFile, json_encode($history));

// ── Build email
$to       = 'thierry@b23.design';
$siteName = 'thierrybezier.com';
$subjectClean = $subject !== '' ? $subject : 'New contact from ' . $siteName;

// Sanitize header values (strip line breaks to prevent header injection)
$cleanName    = preg_replace('/[\r\n]+/', ' ', $name);
$cleanEmail   = preg_replace('/[\r\n]+/', ' ', $email);
$cleanSubject = preg_replace('/[\r\n]+/', ' ', $subjectClean);

$body  = "New message from " . $siteName . "\n";
$body .= str_repeat('─', 50) . "\n\n";
$body .= "Name    : " . $cleanName . "\n";
$body .= "Email   : " . $cleanEmail . "\n";
$body .= "Subject : " . $cleanSubject . "\n";
$body .= "IP      : " . $ip . "\n";
$body .= "Date    : " . date('Y-m-d H:i:s') . "\n\n";
$body .= str_repeat('─', 50) . "\n\n";
$body .= $message . "\n";

$headers  = "From: " . $siteName . " <noreply@" . parse_url('https://thierrybezier.com', PHP_URL_HOST) . ">\r\n";
$headers .= "Reply-To: " . $cleanName . " <" . $cleanEmail . ">\r\n";
$headers .= "X-Mailer: PHP/" . phpversion() . "\r\n";
$headers .= "MIME-Version: 1.0\r\n";
$headers .= "Content-Type: text/plain; charset=UTF-8\r\n";

$ok = @mail($to, '[Portfolio] ' . $cleanSubject, $body, $headers);

if ($ok) {
    echo json_encode(['ok' => true]);
} else {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'mail_failed']);
}
