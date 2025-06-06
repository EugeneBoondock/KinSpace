import { Metadata } from 'next';
import ProfileContent from './ProfileContent';

type PageProps = {
  params: { userId: string };
  searchParams: { [key: string]: string | string[] | undefined };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  return {
    title: `Profile - ${params.userId}`,
  };
}

export default async function Page({ params }: PageProps) {
  return <ProfileContent userId={params.userId} />;
}
