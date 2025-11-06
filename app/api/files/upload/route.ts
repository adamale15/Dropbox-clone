import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { files } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import ImageKit from "imagekit";
import { v4 as uuidv4 } from "uuid";
import { NextRequest, NextResponse } from "next/server";

// Imagekit credentials
const imagekit = new ImageKit({
  publicKey: process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY || "",
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY || "",
  urlEndpoint: process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT || "",
});

export async function POST(request: NextRequest) {
  try {
    // Validate ImageKit configuration
    if (
      !process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY ||
      !process.env.IMAGEKIT_PRIVATE_KEY ||
      !process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT
    ) {
      console.error("ImageKit environment variables are missing");
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    //Parse formdata
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const formUserId = formData.get("userId") as string;
    const parentId = (formData.get("parentId") as string) || null;

    //Match it with userId
    if (formUserId !== userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // If file exists
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Ensure parentId exists if provided
    if (parentId) {
      // It belongs to user
      const [parentFolder] = await db
        .select()
        .from(files)
        .where(
          and(
            eq(files.id, parentId), // Ensure it exists
            eq(files.userId, userId), // Ensure it belongs to the user
            eq(files.isFolder, true) // Ensure that it is a folder
          )
        );

      if (!parentFolder) {
        return NextResponse.json(
          { error: "Parent folder not found" },
          { status: 404 }
        );
      }
    }

    // Check if file is of type Image/pdf
    if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
      return NextResponse.json(
        { error: "Only images and pdf are supported" },
        { status: 401 }
      );
    }

    //Convert file into buffer
    const buffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(buffer);

    //Generate filename
    const folderPath = parentId
      ? `/droply/${userId}/folder/${parentId}`
      : `/droply/${userId}`;

    const originalFileName = file.name;

    const fileExtension = originalFileName.split(".").pop() || "";

    //Check for empty extension
    if (!fileExtension) {
      return NextResponse.json(
        { error: "File must have an extension" },
        { status: 400 }
      );
    }
    // Validation for not storing exe, php, etc
    const uniqueFileName = `${uuidv4()}.${fileExtension}`;

    //Upload file to imageKit
    let uploadResponse;
    try {
      uploadResponse = await imagekit.upload({
        file: fileBuffer,
        fileName: uniqueFileName,
        folder: folderPath,
        useUniqueFileName: false,
      });
    } catch (imagekitError: any) {
      console.error("ImageKit upload error:", imagekitError);
      return NextResponse.json(
        {
          error: "Failed to upload file to storage",
          message: imagekitError.message || "ImageKit upload failed",
        },
        { status: 500 }
      );
    }

    if (!uploadResponse || !uploadResponse.filePath || !uploadResponse.url) {
      console.error("Invalid ImageKit response:", uploadResponse);
      return NextResponse.json(
        { error: "Invalid response from storage service" },
        { status: 500 }
      );
    }

    const fileData = {
      name: originalFileName,
      path: uploadResponse.filePath,
      size: file.size,
      type: file.type,
      fileUrl: uploadResponse.url,
      thumbnailUrl: uploadResponse.thumbnailUrl || null,
      userId: userId,
      parentId: parentId,
      isFolder: false,
      isStarred: false,
      isTrash: false,
    };

    let newFile;
    try {
      const result = await db.insert(files).values(fileData).returning();
      if (!result || result.length === 0) {
        throw new Error("Database insert returned no results");
      }
      newFile = result[0];
    } catch (dbError: any) {
      console.error("Database insert error:", dbError);
      // Try to delete the file from ImageKit if database insert fails
      try {
        if (uploadResponse.fileId) {
          await imagekit.deleteFile(uploadResponse.fileId);
        }
      } catch (deleteError) {
        console.error("Failed to cleanup ImageKit file:", deleteError);
      }
      return NextResponse.json(
        {
          error: "Failed to save file information",
          message: dbError.message || "Database error",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(newFile);
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      {
        error: "Failed to upload file",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
