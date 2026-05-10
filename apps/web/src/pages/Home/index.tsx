import { Typography, Button, Space } from 'antd'

const { Title, Paragraph } = Typography

export default function Home() {
  return (
    <div>
      <Title level={2}>首页</Title>
      <Paragraph>欢迎来到 XM Business</Paragraph>
      <Space>
        <Button type="primary">开始使用</Button>
      </Space>
    </div>
  )
}
