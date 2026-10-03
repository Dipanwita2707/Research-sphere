/**
 * Local file storage (STORAGE_DRIVER=local, the default): uploads, downloads, metadata and
 * deletes stay on disk under backend/src/uploads, and keys cannot escape that folder.
 */
const fs = require('fs');
const path = require('path');

const storage = require('../../../shared/utils/s3');

const readStream = (stream) => new Promise((resolve, reject) => {
  const chunks = [];
  stream.on('data', (c) => chunks.push(c));
  stream.on('end', () => resolve(Buffer.concat(chunks)));
  stream.on('error', reject);
});

describe('local storage driver', () => {
  const prev = process.env.STORAGE_DRIVER;
  const created = [];
  beforeEach(() => { delete process.env.STORAGE_DRIVER; });
  afterAll(() => {
    if (prev === undefined) delete process.env.STORAGE_DRIVER; else process.env.STORAGE_DRIVER = prev;
    for (const f of created) { try { fs.unlinkSync(f); } catch (_) { /* already gone */ } }
    try { fs.rmSync(path.join(storage.LOCAL_ROOT, '__jest_storage__'), { recursive: true, force: true }); } catch (_) { /* ignore */ }
  });

  test('defaults to local, and only "s3" switches to S3', () => {
    expect(storage.storageDriver()).toBe('local');
    process.env.STORAGE_DRIVER = 'S3';
    expect(storage.storageDriver()).toBe('s3');
    process.env.STORAGE_DRIVER = 'anything';
    expect(storage.storageDriver()).toBe('local');
  });

  test('upload → exists → metadata → download → delete, all on disk', async () => {
    const body = Buffer.from('%PDF-1.4 local storage test');
    const res = await storage.uploadToS3(body, '__jest_storage__', 'user-1', 'My Report.pdf', 'application/pdf');
    expect(res.storage).toBe('local');
    expect(res.location).toBeNull();
    expect(res.key).toMatch(/^__jest_storage__\/user-1\/\d+-[a-f0-9]{12}-My_Report\.pdf$/);

    const full = path.join(storage.LOCAL_ROOT, ...res.key.split('/'));
    created.push(full);
    expect(fs.readFileSync(full).equals(body)).toBe(true);

    expect(await storage.fileExistsInS3(res.key)).toBe(true);
    const meta = await storage.getS3FileMetadata(res.key);
    expect(meta.contentLength).toBe(body.length);
    expect(meta.contentType).toBe('application/pdf');

    const dl = await storage.downloadFromS3(res.key);
    expect((await readStream(dl.stream)).equals(body)).toBe(true);

    await storage.deleteFromS3(res.key);
    expect(fs.existsSync(full)).toBe(false);
    expect(await storage.fileExistsInS3(res.key)).toBe(false);
  });

  test('missing files report "not found" like S3 did', async () => {
    await expect(storage.downloadFromS3('__jest_storage__/nobody/missing.pdf')).rejects.toThrow('File not found');
    await expect(storage.getS3FileMetadata('__jest_storage__/nobody/missing.pdf')).rejects.toThrow('File not found');
  });

  test('keys cannot escape the uploads folder', async () => {
    expect(await storage.fileExistsInS3('../../.env')).toBe(false);
    await expect(storage.downloadFromS3('../package.json')).rejects.toThrow('File not found');
    await expect(storage.deleteFromS3('../../package.json')).resolves.toBeUndefined();
    expect(fs.existsSync(path.join(__dirname, '..', '..', '..', '..', 'package.json'))).toBe(true);
  });

  test('upload never touches S3 in local mode', async () => {
    const send = jest.spyOn(storage.s3Client, 'send');
    const res = await storage.uploadToS3(Buffer.from('x'), '__jest_storage__', 'user-2', 'a.txt');
    created.push(path.join(storage.LOCAL_ROOT, ...res.key.split('/')));
    expect(send).not.toHaveBeenCalled();
    send.mockRestore();
  });
});
