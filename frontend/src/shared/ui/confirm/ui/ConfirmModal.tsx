import { Button, Group, Modal, Text } from "@mantine/core"

type Props = {
  opened: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  loading?: boolean
  onConfirm: () => void
  onClose: () => void
}

export const ConfirmModal = ({
  opened,
  title,
  message,
  confirmLabel = "Подтвердить",
  cancelLabel = "Отмена",
  loading,
  onConfirm,
  onClose
}: Props) => (
  <Modal centered opened={opened} title={title} onClose={onClose}>
    <Text size="sm">{message}</Text>
    <Group justify="flex-end" mt="md">
      <Button disabled={loading} variant="default" onClick={onClose}>
        {cancelLabel}
      </Button>
      <Button color="red" loading={loading} onClick={onConfirm}>
        {confirmLabel}
      </Button>
    </Group>
  </Modal>
)
