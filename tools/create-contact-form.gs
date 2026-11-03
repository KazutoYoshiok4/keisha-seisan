/**
 * バイバイ精算の「お問い合わせ」フォームを作る Google Apps Script。
 *
 * 使い方（1回だけ）:
 *   1. https://script.google.com/ で「新しいプロジェクト」を開き、このファイルの中身をすべて貼り付けて保存する。
 *   2. 関数「createContactForm」を選んで「実行」を押す。初回はGoogleアカウントの許可を求められるので許可する。
 *   3. 実行ログに出る「回答用URL」を about.html のリンクに使う。
 *
 * できるもの:
 *   - Googleドライブに「バイバイ精算 お問い合わせ」フォーム（回答者のメールアドレスは自動で集めない）
 *   - 回答が届くたびに、このスクリプトを実行したアカウントへ通知メールを送るトリガー
 */
function createContactForm() {
  const form = FormApp.create('バイバイ精算 お問い合わせ');
  form.setDescription([
    'バイバイ精算（傾斜つき割り勘・飲み会の幹事に）への、不具合のご報告やご要望はこちらからお送りください。',
    '個人で運営しているため、お返事にお時間をいただくことや、すべてのご要望にはお応えできないことがあります。',
    'ツールに入力した参加者の名前や金額など、個人を特定できる情報は書かないでください。'
  ].join('\n'));

  // 回答者のメールアドレスは自動で集めない（返信が必要な人だけ任意の欄に書いてもらう）。
  if (typeof form.setEmailCollectionType === 'function') {
    form.setEmailCollectionType(FormApp.EmailCollectionType.DO_NOT_COLLECT);
  } else {
    form.setCollectEmail(false);
  }
  form.setAllowResponseEdits(false);
  form.setShowLinkToRespondAgain(false);
  form.setConfirmationMessage('送信ありがとうございました。内容を確認します。');

  form.addMultipleChoiceItem()
    .setTitle('お問い合わせの種類')
    .setChoiceValues(['不具合のご報告', 'ご要望・ご意見', 'その他'])
    .setRequired(true);
  form.addParagraphTextItem()
    .setTitle('内容')
    .setHelpText('不具合の場合は、どの操作をしたときに、どうなったかを書いてください。')
    .setRequired(true);
  form.addTextItem()
    .setTitle('お使いの端末とブラウザ（任意）')
    .setHelpText('例：iPhoneのSafari、PCのChrome');
  form.addTextItem()
    .setTitle('返信先のメールアドレス（任意）')
    .setHelpText('お返事が必要な場合だけご記入ください。返信以外には使いません。')
    .setValidation(FormApp.createTextValidation().requireTextIsEmail().build());

  // 回答が届いたらメールで知らせる。
  ScriptApp.newTrigger('notifyNewResponse').forForm(form).onFormSubmit().create();

  Logger.log('回答用URL（about.html に載せる）: ' + form.getPublishedUrl());
  Logger.log('編集用URL（自分用）: ' + form.getEditUrl());
}

/** 回答が届いたときに、スクリプトの持ち主へ内容をメールする。 */
function notifyNewResponse(e) {
  const lines = e.response.getItemResponses().map(r => `■ ${r.getItem().getTitle()}\n${r.getResponse()}`);
  MailApp.sendEmail({
    to: Session.getEffectiveUser().getEmail(),
    subject: '【バイバイ精算】お問い合わせが届きました',
    body: lines.join('\n\n') + '\n\n回答の一覧: ' + e.source.getEditUrl()
  });
}
