export async function uploadFile(fileBuffer: ArrayBuffer | Buffer, filename: string): Promise<string> {
    const extension = filename.split('.').pop();

    const timestamp = new Date().getTime();
    const random = Math.floor(Math.random() * 1000000) + 1;
    const generatedFileName = `${timestamp}_${random}.${extension}`;
    const formData = new FormData();

    const url = `${Bun.env.FILE_UPLOAD_ENDPOINT}?filename=${generatedFileName}`;

    formData.append('file', new Blob([fileBuffer]), generatedFileName);

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${Bun.env.FILE_UPLOAD_TOKEN}`,
        },
        body: formData,
    })
    const responseText = await response.text();

    const data = JSON.parse(responseText);

    return `${Bun.env.FILE_DOWNLOAD_ENDPOINT}/${data.filename}`;
}
